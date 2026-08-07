import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WalletProvider, useWallet } from "./contexts/WalletContext";
import { useContractState } from "./hooks/useContractState";
import { NetworkBadge } from "./components/NetworkBadge";
import { WalletSelector } from "./components/WalletSelector";
import { AdminPanel } from "./components/AdminPanel";
import { SKWorkspace } from "./components/SKWorkspace";
import { YouthDashboard } from "./components/YouthDashboard";
import { TransparencyHub } from "./components/TransparencyHub";
import { TransactionLifecycleModal } from "./components/TransactionLifecycleModal";
import { ErrorValidationModal } from "./components/ErrorValidationModal";
import type { TransactionStatus } from "./types";
import { LoadingSpinner } from "./components/LoadingSpinner";
import {
  Lock, Camera, CheckSquare, ShieldCheck, UserCheck, Menu, X, AlertTriangle, Info, LogOut, Layout, BookOpen, Settings,
  ChevronDown, ChevronRight, Activity, Bell, User, Mail, AlertCircle
} from "lucide-react";
import { db } from "./services/firebase";
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from "firebase/firestore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { compressImage } from "./utils/imageCompressor";
import { DevConsole } from "./components/DevConsole";
import { logger } from "./utils/logger";
import { DEBUG_MODE, setDebugMode } from "./config/debug";


type ViewState = "landing" | "auth" | "dashboard";
type RoleType = "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer";
type MenuKey = "dashboard" | "projects" | "voting" | "notifications" | "profile" | "admin";

interface MainLayoutProps {
  setViewState: (state: ViewState) => void;
  isGuest: boolean;
  setIsGuest: (val: boolean) => void;
}

interface NotificationsPanelProps {
  profile: any;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ profile }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, "notifications"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.targetUid === profile.uid || (data.barangayId && data.barangayId === profile.barangayId)) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setNotifications(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const docRef = doc(db, "notifications", id);
      await updateDoc(docRef, { read: true });
    } catch (err: any) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  return (
    <div className="panel-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 className="panel-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bell size={24} style={{ color: "var(--primary)" }} /> Notifications Catalog
        </h2>
        <span className="badge badge-success">
          {notifications.filter((n) => !n.read).length} New
        </span>
      </div>

      {loading ? (
        <LoadingSpinner size="md" label="Loading alerts..." />
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
          <Bell size={48} style={{ opacity: 0.2, marginBottom: "1rem" }} />
          <p>No notifications found for your profile at this time.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                background: n.read ? "transparent" : "rgba(37, 99, 235, 0.03)",
                border: `1px solid ${n.read ? "var(--border-glass)" : "rgba(37, 99, 235, 0.15)"}`,
                borderRadius: "16px",
                padding: "1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                transition: "var(--transition-smooth)"
              }}
            >
              <div style={{ flex: 1, paddingRight: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>{n.title}</h4>
                  {!n.read && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)" }}></span>}
                </div>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {n.message}
                </p>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.5rem", display: "block" }}>
                  {n.timestamp ? new Date(n.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
              {!n.read && (
                <button
                  className="btn btn-outline-navy btn-sm"
                  onClick={() => handleMarkAsRead(n.id)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ProfileSettingsPanelProps {
  profile: any;
  xlmBalance: string;
}

export const ProfileSettingsPanel: React.FC<ProfileSettingsPanelProps> = ({ profile, xlmBalance }) => {
  const isPending = profile?.status !== "active";
  const { user } = useAuth();

  const isPendingReview = profile?.status === "pending";
  const isPendingEmail = profile?.status === "pending_email_verification";
  const isApproved = profile?.verificationStatus === "approved" || profile?.status === "pending_email_verification" || profile?.status === "active";

  const roleLabel = profile?.requestedRole === "barangay_admin" ? "Barangay Admin" : "Resident";
  const approverLabel = profile?.requestedRole === "barangay_admin" ? "System Admin" : "Barangay Admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Profile Under Review checklist for pending users */}
      {isPending && (
        <div className="panel-card" style={{ border: "1px solid var(--border-glass)", background: "rgba(245, 158, 11, 0.03)", position: "relative" }}>
          <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--warning)", marginBottom: "0.5rem" }}>
            <Info size={24} /> {roleLabel} Profile Under Review
          </h2>
          <p style={{ margin: "0 0 1.5rem 0", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Your account application is currently undergoing identity audits and verification. Complete the remaining steps to fully activate your wallet and voting features.
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", textAlign: "left" }}>
            {[
              { label: "Account Created", done: true },
              { label: "Documents Uploaded", done: !!profile?.idPhotoUrl && profile?.idPhotoUrl !== "N/A" },
              { label: "AI Verification Finished", done: !!profile?.verificationStatus && profile?.verificationStatus !== "pending" && profile?.verificationStatus !== "pending_email_verification", extra: profile?.scores?.overallScore ? `Confidence score: ${profile.scores.overallScore}%` : undefined },
              { label: "Waiting Review & Approval", done: isApproved, pending: isPendingReview, extra: isApproved ? `Approved by ${approverLabel}` : `Queued for ${approverLabel} audit (24-48h)` },
              { label: "Email Address Verification", done: user?.emailVerified || false, pending: isPendingEmail && !user?.emailVerified, extra: `Registered email: ${profile?.email || user?.email}` },
              { label: "Resident Account Activated", done: profile?.status === "active" }
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: step.done ? "#10b981" : step.pending ? "var(--primary)" : "rgba(0,0,0,0.1)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  marginTop: "2px"
                }}>
                  {step.done ? "✓" : "⏳"}
                </span>
                <div>
                  <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, color: step.done || step.pending ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {step.label}
                  </span>
                  {step.extra && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{step.extra}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet Management Section */}
      {isPending ? (
        <div className="panel-card" style={{ opacity: 0.7 }}>
          <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Activity size={24} style={{ color: "var(--text-muted)" }} /> Wallet Locked
          </h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Wallet connection becomes available after your account has completed identity and email verification.
          </p>
        </div>
      ) : (
        <div className="panel-card">
          <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Activity size={24} style={{ color: "var(--primary)" }} /> Stellar Ledger Integration
          </h2>
          <p className="panel-subtitle" style={{ marginBottom: "1.5rem" }}>
            Link your Stellar Testnet wallet to authorize governance voting signatures or milestone escrows.
          </p>

          <WalletSelector balance={xlmBalance} />

          {profile?.walletAddress && (
            <div style={{ marginTop: "1.5rem", background: "rgba(22, 163, 74, 0.03)", border: "1px solid rgba(22, 163, 74, 0.15)", borderRadius: "16px", padding: "1.25rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--success)", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <ShieldCheck size={18} /> Profile Wallet Locked
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Linked Provider:</span>
                  <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{profile.walletProvider || "Freighter"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Linked Date:</span>
                  <span style={{ fontWeight: 700 }}>
                    {profile.walletLinkedAt ? new Date(profile.walletLinkedAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Verification:</span>
                  <span style={{ fontWeight: 700, color: "var(--success)" }}>SECURED & BOUND</span>
                </div>
              </div>
              <p style={{ margin: "0.75rem 0 0 0", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                ⚠️ **Security Rule:** To prevent double-voting or Sybil exploits, you are restricted to one active Stellar wallet address. To change it, submit a verification appeal to your Barangay Admin.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Profile Information Section */}
      <div className="panel-card">
        <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <User size={24} style={{ color: "var(--primary)" }} /> Resident Profile Identity
        </h2>

        <div className="grid-2" style={{ gap: "2rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>FULL NAME</span>
              <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>{profile?.name}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>EMAIL ADDRESS</span>
              <span style={{ fontSize: "1rem", color: "var(--text-secondary)" }}>{profile?.email}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>BARANGAY JURISDICTION</span>
              <span style={{ fontSize: "1rem", fontWeight: 700 }}>{profile?.barangayName || "Unassigned"}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>RESIDENTIAL ADDRESS</span>
              <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>{profile?.address || "N/A"}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>PHONE NUMBER</span>
              <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>{profile?.mobileNumber || "N/A"}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>ASSIGNED ROLE</span>
              <span style={{ fontSize: "1rem", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>
                {isPending
                  ? `${profile?.requestedRole === "barangay_admin" ? "Pending Barangay Admin" : "Pending Resident"}`
                  : `${profile?.role?.replace("_", " ")}`}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>IDENTITY VERIFICATION</span>
              <span style={{ fontWeight: 700 }} className={`badge badge-${profile?.verified ? "success" : "warning"}`}>
                {profile?.verified ? "VERIFIED RESIDENT" : "PENDING REVIEW"}
              </span>
            </div>

            {isPending && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>AI CONFIDENCE SUMMARY</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--primary)" }}>
                    {profile?.scores?.overallScore || 85}% Confidence ({profile?.aiDecision || "PENDING"})
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>EMAIL VERIFICATION STATUS</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: user?.emailVerified ? "var(--success)" : "var(--warning)" }}>
                    {user?.emailVerified ? "✓ VERIFIED & CONFIRMED" : "⏳ PENDING ACTIVATION LINK"}
                  </span>
                </div>
              </>
            )}

            {profile?.idType && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>GOVERNMENT ID TYPE / NUMBER</span>
                <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>
                  {profile.idType.toUpperCase()} ({profile.idNumber})
                </span>
              </div>
            )}

            {profile?.idPhotoUrl && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>SUBMITTED IDENTITY PHOTO</span>
                <div style={{ width: "200px", height: "130px", border: "1px solid var(--border-glass)", borderRadius: "12px", overflow: "hidden" }}>
                  <img src={profile.idPhotoUrl} alt="Submitted ID" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Developer Diagnostics Card */}
      <div className="panel-card" style={{ marginTop: "1.5rem", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
        <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Settings size={24} style={{ color: "var(--primary)" }} /> Developer Settings & Diagnostics
        </h2>
        <p className="panel-subtitle" style={{ marginBottom: "1.25rem" }}>
          Toggle debug logging, view live transaction state updates, and access the observability suite panel.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button 
            className={`btn ${DEBUG_MODE ? "btn-danger" : "btn-primary"}`}
            onClick={() => {
              console.log("[Developer Diagnostics] Toggling DEBUG_MODE...");
              setDebugMode(!DEBUG_MODE);
            }}
            style={{ fontWeight: 700 }}
          >
            {DEBUG_MODE ? "Disable Debug Mode" : "Enable Debug Mode & Console"}
          </button>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {DEBUG_MODE 
              ? "✓ Debug Mode is active. Floating console button is visible in the bottom-right." 
              : "Debug Mode is off. Floating console button is hidden."}
          </span>
        </div>
      </div>
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ setViewState, isGuest, setIsGuest }) => {
  const { projects, eventLogs, loading, xlmBalance, error: stateError } = useContractState();
  const { address, connected, connect, disconnect } = useWallet();
  const { profile, user, signOut } = useAuth();
  const isPending = profile?.status !== "active";

  // Collapsible Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Role Switcher / Simulator Override state (for hackathon testing on localhost)
  const [activeRole, setActiveRole] = useState<RoleType>("viewer");
  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");

  // Stellar L2 Error Error Toast States
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  // Sync simulated role with auth profile role by default
  useEffect(() => {
    if (isGuest) {
      setActiveRole("viewer");
      setActiveMenu("dashboard");
      return;
    }

    if (profile?.role) {
      if (profile.role === "system_admin") {
        setActiveRole("system_admin");
        setActiveMenu("admin");
      } else if (profile.role === "barangay_admin") {
        setActiveRole("barangay_admin");
        setActiveMenu("admin");
      } else if (profile.role === "sk_official") {
        setActiveRole("sk_official");
        setActiveMenu("projects");
      } else if (profile.role === "resident") {
        setActiveRole("resident");
        setActiveMenu("voting");
      } else {
        setActiveRole("viewer");
        setActiveMenu("dashboard");
      }
    }
  }, [profile, isGuest]);

  // Transaction execution tracking state
  const [txStatus, setTxStatus] = useState<TransactionStatus>("Idle");
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [txError, setTxError] = useState<string | undefined>(undefined);

  const executeAction = async (
    actionFn: (
      onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
    ) => Promise<string>
  ) => {
    setTxError(undefined);
    setTxHash(undefined);
    try {
      await actionFn((status, hash, err) => {
        setTxStatus(status);
        if (hash) setTxHash(hash);
        if (err) {
          setTxError(err);
          // Standardize error mapping for Stellar L2 alerts
          if (err.includes("missing") || err.includes("not found")) {
            showErrorToast("Wallet Not Found: Freighter extension missing.");
          } else if (err.includes("declined") || err.includes("rejected")) {
            showErrorToast("Transaction Rejected: User declined in wallet popup.");
          } else if (err.includes("balance") || err.includes("underfunded")) {
            showErrorToast("Insufficient Balance: Need testnet XLM for gas fees.");
          } else {
            showErrorToast(err);
          }
        }
      });
    } catch (err: any) {
      console.error("Action execution caught error:", err);
    }
  };

  const showErrorToast = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast(null);
    }, 6000);
  };

  const handleCloseTxModal = () => {
    setTxStatus("Idle");
    setTxHash(undefined);
    setTxError(undefined);
  };

  const handleLogout = async () => {
    try {
      disconnect();
    } catch (e) {
      console.error("Wallet disconnect on logout failed:", e);
    }
    if (!isGuest) {
      await signOut();
    }
    setIsGuest(false);
    setViewState("landing");
  };

  const getRoleAccentClass = () => {
    switch (activeRole) {
      case "system_admin":
        return {
          theme: "theme-emerald",
          accent: "text-emerald-400",
          bg: "bg-emerald-600",
          border: "border-emerald-500",
          glow: "rgba(16, 185, 129, 0.25)"
        };
      case "barangay_admin":
        return {
          theme: "theme-blue",
          accent: "text-blue-400",
          bg: "bg-blue-600",
          border: "border-blue-500",
          glow: "rgba(59, 130, 246, 0.25)"
        };
      case "sk_official":
        return {
          theme: "theme-amber",
          accent: "text-amber-400",
          bg: "bg-amber-500",
          border: "border-amber-500",
          glow: "rgba(245, 158, 11, 0.25)"
        };
      case "resident":
        return {
          theme: "theme-teal",
          accent: "text-teal-400",
          bg: "bg-teal-500",
          border: "border-teal-500",
          glow: "rgba(20, 184, 166, 0.25)"
        };
      case "viewer":
      default:
        return {
          theme: "theme-slate",
          accent: "text-slate-400",
          bg: "bg-slate-600",
          border: "border-slate-500",
          glow: "rgba(100, 116, 139, 0.25)"
        };
    }
  };

  const themeClass = getRoleAccentClass();

  const renderBannerNotice = () => {
    if (isGuest) {
      return (
        <div className="banner-notice bg-slate-soft border-slate text-slate-light mb-4">
          <Info size={20} />
          <span><strong>Public Guest Mode:</strong> You are auditing public records. Please click <em>Register</em> or <em>Sign In</em> to vote or manage escrows.</span>
        </div>
      );
    }

    if (profile && profile.verificationStatus === "auto_rejected") {
      return (
        <div className="banner-notice bg-rose-soft border-rose text-rose-light mb-4">
          <AlertCircle size={20} />
          <span>
            <strong>⚠️ AI Identity Review Flagged:</strong> Auto-verification flagged duplicate/quality concerns. Your profile is queued for manual audit by the System Admin.
          </span>
        </div>
      );
    }

    if (profile && isPending) {
      const roleLabel = profile.requestedRole === "barangay_admin" ? "Barangay Admin" : "Resident";
      const approverLabel = profile.requestedRole === "barangay_admin" ? "System Admin" : "Barangay Admin";
      return (
        <div className="banner-notice bg-amber-soft border-amber text-amber-light mb-4">
          <Info size={20} />
          <span>
            <strong>⏳ Account Under Review:</strong> Your {roleLabel} registration is being reviewed by the {approverLabel}. You may browse the transparency feed, but voting, escrow, and administration features are locked until approval.
          </span>
        </div>
      );
    }

    if (profile && !profile.walletAddress) {
      return (
        <div className="banner-notice bg-amber-soft border-amber text-amber-light mb-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertTriangle size={20} />
            <span>
              <strong>Stellar Wallet Required:</strong> Connect and link your Stellar wallet under **Profile & Settings** to unlock voting, milestone signing, or budget creation features.
            </span>
          </div>
          <button className="btn btn-outline-navy btn-sm" onClick={() => setActiveMenu("profile")}>
            Go to Settings
          </button>
        </div>
      );
    }

    switch (activeRole) {
      case "system_admin":
        return (
          <div className="banner-notice bg-emerald-soft border-emerald text-emerald-light mb-4">
            <Settings size={20} />
            <span><strong>System Control Mode:</strong> Configure global parameters, monitor Testnet RPC nodes, and audit platform parameters.</span>
          </div>
        );
      case "barangay_admin":
        return (
          <div className="banner-notice bg-blue-soft border-blue text-blue-light mb-4">
            <UserCheck size={20} />
            <span><strong>Barangay Admin Panel:</strong> Audit profile registrations and execute on-chain voter activations.</span>
          </div>
        );
      case "sk_official":
        return (
          <div className="banner-notice bg-amber-soft border-amber text-amber-light mb-4">
            <Info size={20} />
            <span><strong>SK Official Workspace:</strong> Propose local budgets, commit XLM escrows, and claim milestone funds.</span>
          </div>
        );
      case "resident":
        return (
          <div className="banner-notice bg-teal-soft border-teal text-teal-light mb-4">
            <CheckSquare size={20} />
            <span><strong>Verified Resident Portal:</strong> Audit milestone proofs and submit signatures to release budget escrows.</span>
          </div>
        );
      case "viewer":
      default:
        return (
          <div className="banner-notice bg-slate-soft border-slate text-slate-light mb-4">
            <Info size={20} />
            <span><strong>Transparency Mode:</strong> Public read-only catalog feed. Connect wallet and request verification to vote.</span>
          </div>
        );
    }
  };

  const renderMainWorkspace = () => {
    if (loading && projects.length === 0) {
      return <LoadingSpinner size="lg" label="Synchronizing ledger state..." />;
    }

    const isPending = profile?.status !== "active";

    switch (activeMenu) {
      case "dashboard":
        if (profile?.status === "pending_email_verification") {
          return <VerifyEmailScreen profile={profile} onLogout={handleLogout} />;
        }
        return <TransparencyHub projects={projects} eventLogs={eventLogs} />;

      case "voting":
        if (isGuest) return null;
        if (!connected) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔑</div>
              <h3>Stellar Wallet Required</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                Voter signatures require secure wallet authorization. Please connect Freighter, xBull, or Albedo.
              </p>
              <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
            </div>
          );
        }
        if (!profile?.walletAddress) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
              <h3>Stellar Wallet Not Linked</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                You must link your Stellar wallet address to your profile first. Navigate to the **Profile & Settings** tab to bind your wallet.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveMenu("profile")}>Go to Profile & Settings</button>
            </div>
          );
        }
        if (address && profile.walletAddress && address.toLowerCase() !== profile.walletAddress.toLowerCase()) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
              <h3>Wallet Address Mismatch</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                The connected wallet address (<code>{address.slice(0, 6)}...{address.slice(-6)}</code>) does not match your profile's linked address (<code>{profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-6)}</code>). Please switch accounts in your wallet extension.
              </p>
            </div>
          );
        }
        if (isPending) {
          return <LockedPage pageName="Milestone Voting" onOpenUnlockDialog={() => setUnlockDialogOpen(true)} />;
        }
        return (
          <YouthDashboard
            voterAddress={address!}
            projects={projects}
            onExecute={executeAction}
          />
        );

      case "projects":
        if (isGuest) return null;
        if (!connected) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔑</div>
              <h3>Stellar Wallet Required</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                Creating project escrows requires on-chain commitments. Please connect Freighter or xBull.
              </p>
              <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
            </div>
          );
        }
        if (!profile?.walletAddress) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
              <h3>Stellar Wallet Not Linked</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                You must link your Stellar wallet address to your profile first. Navigate to the **Profile & Settings** tab to bind your wallet.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveMenu("profile")}>Go to Profile & Settings</button>
            </div>
          );
        }
        if (address && profile.walletAddress && address.toLowerCase() !== profile.walletAddress.toLowerCase()) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
              <h3>Wallet Address Mismatch</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                The connected wallet address does not match your profile's linked address. Please switch accounts in your wallet extension.
              </p>
            </div>
          );
        }
        if (isPending) {
          return <LockedPage pageName="SK Workspace" onOpenUnlockDialog={() => setUnlockDialogOpen(true)} />;
        }
        return (
          <SKWorkspace
            skAddress={address!}
            projects={projects}
            onExecute={executeAction}
          />
        );

      case "admin":
        if (isGuest) return null;

        // System Admin manages platform off-chain (LGUs & Admins) and does not require a Stellar wallet to view the queues
        const isSystemAdmin = profile?.role === "system_admin";

        if (!isSystemAdmin) {
          if (!connected) {
            return (
              <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔑</div>
                <h3>Stellar Wallet Required</h3>
                <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                  Confirming resident activations requires Admin signing. Please connect Freighter.
                </p>
                <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
              </div>
            );
          }
          if (!profile?.walletAddress) {
            return (
              <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
                <h3>Stellar Wallet Not Linked</h3>
                <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                  You must link your Stellar wallet address to your profile first. Navigate to the **Profile & Settings** tab to bind your wallet.
                </p>
                <button className="btn btn-primary" onClick={() => setActiveMenu("profile")}>Go to Profile & Settings</button>
              </div>
            );
          }
          if (address && profile.walletAddress && address.toLowerCase() !== profile.walletAddress.toLowerCase()) {
            return (
              <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
                <h3>Wallet Address Mismatch</h3>
                <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                  The connected wallet address does not match your profile's linked address. Please switch accounts in your wallet extension.
                </p>
              </div>
            );
          }
        }
        if (isPending) {
          return <LockedPage pageName="Administration" onOpenUnlockDialog={() => setUnlockDialogOpen(true)} />;
        }
        return <AdminPanel adminAddress={address || ""} onExecute={executeAction} />;

      case "notifications":
        if (isPending) {
          return <LockedPage pageName="Notifications" onOpenUnlockDialog={() => setUnlockDialogOpen(true)} />;
        }
        return <NotificationsPanel profile={profile} />;

      case "profile":
        if (isGuest) return null;
        return <ProfileSettingsPanel profile={profile} xlmBalance={xlmBalance} />;

      default:
        return null;
    }
  };

  return (
    <div className={`main-app-shell ${themeClass.theme}`}>
      {errorToast && (
        <div className="error-toast-overlay">
          <div className="error-toast-card">
            <AlertTriangle size={20} className="text-danger" />
            <div className="error-toast-content">
              <span>{errorToast}</span>
            </div>
            <button className="error-toast-close" onClick={() => setErrorToast(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="app-top-header">
        <div className="header-brand-group">
          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu size={24} />
          </button>
          <span className="brand-logo">Barangay Bond</span>
          <span className="barangay-badge">Central Barangay</span>
          <span className={`role-pill-badge ${themeClass.bg}`}>
            {isGuest ? "GUEST AUDITOR" : isPending ? `PENDING ${activeRole.replace("_", " ").toUpperCase()}` : activeRole.replace("_", " ").toUpperCase()}
          </span>
        </div>

        <div className="header-actions-group">


          <NetworkBadge />
          {!isGuest && <WalletSelector balance={xlmBalance} />}

          {isGuest ? (
            <button className="btn btn-primary btn-sm" onClick={() => setViewState("auth")}>
              Register / Sign In
            </button>
          ) : (
            <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
              <LogOut size={16} style={{ marginRight: "0.25rem" }} /> Logout
            </button>
          )}
        </div>
      </header>

      <div className="shell-body-layout">
        <aside className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-header-toggle">
            <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              <Menu size={20} />
            </button>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${activeMenu === "dashboard" ? "active" : ""}`}
              onClick={() => { setActiveMenu("dashboard"); setMobileMenuOpen(false); }}
            >
              <Layout size={20} />
              <span className="nav-label">Dashboard</span>
            </button>

            {/* Projects Tab */}
            {!isGuest && (activeRole === "sk_official" || activeRole === "resident" || activeRole === "viewer") && (
              <button
                className={`sidebar-nav-item ${activeMenu === "projects" ? "active" : ""}`}
                onClick={() => { setActiveMenu("projects"); setMobileMenuOpen(false); }}
              >
                <BookOpen size={20} />
                <span className="nav-label">{activeRole === "sk_official" ? "My Projects" : "Audit Projects"}</span>
              </button>
            )}

            {/* Voting Tab */}
            {!isGuest && (activeRole === "resident" || activeRole === "sk_official") && (
              <button
                className={`sidebar-nav-item ${activeMenu === "voting" ? "active" : ""}`}
                onClick={() => {
                  if (isPending) {
                    setUnlockDialogOpen(true);
                  } else {
                    setActiveMenu("voting");
                  }
                  setMobileMenuOpen(false);
                }}
              >
                <CheckSquare size={20} />
                <span className="nav-label">Milestone Voting {isPending && "🔒"}</span>
              </button>
            )}

            {/* Admin Console */}
            {!isGuest && (activeRole === "system_admin" || activeRole === "barangay_admin") && (
              <button
                className={`sidebar-nav-item ${activeMenu === "admin" ? "active" : ""}`}
                onClick={() => {
                  if (isPending) {
                    setUnlockDialogOpen(true);
                  } else {
                    setActiveMenu("admin");
                  }
                  setMobileMenuOpen(false);
                }}
              >
                <Settings size={20} />
                <span className="nav-label">Admin Console {isPending && "🔒"}</span>
              </button>
            )}

            {/* Notifications Tab */}
            {!isGuest && (
              <button
                className={`sidebar-nav-item ${activeMenu === "notifications" ? "active" : ""}`}
                onClick={() => {
                  if (isPending) {
                    setUnlockDialogOpen(true);
                  } else {
                    setActiveMenu("notifications");
                  }
                  setMobileMenuOpen(false);
                }}
              >
                <Bell size={20} />
                <span className="nav-label">Notifications {isPending && "🔒"}</span>
              </button>
            )}

            {/* Profile & Settings Tab */}
            {!isGuest && (
              <button
                className={`sidebar-nav-item ${activeMenu === "profile" ? "active" : ""}`}
                onClick={() => { setActiveMenu("profile"); setMobileMenuOpen(false); }}
              >
                <User size={20} />
                <span className="nav-label">Profile & Settings</span>
              </button>
            )}
          </nav>

          <div className="sidebar-footer">
            <span className="sidebar-footer-text">
              {sidebarCollapsed ? "v2.0" : "Barangay Bond v2.0"}
            </span>
          </div>
        </aside>

        {mobileMenuOpen && <div className="sidebar-mobile-backdrop" onClick={() => setMobileMenuOpen(false)}></div>}

        <main className="shell-main-workspace">
          {renderBannerNotice()}
          {stateError && <div className="form-error-msg mb-4">{stateError}</div>}
          {renderMainWorkspace()}
        </main>
      </div>

      <TransactionLifecycleModal
        status={txStatus}
        txHash={txHash}
        error={txError}
        onClose={handleCloseTxModal}
      />

      <UnlockDialog
        profile={profile}
        user={user}
        isOpen={unlockDialogOpen}
        onClose={() => setUnlockDialogOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  );
};

interface LandingPageProps {
  setViewState: (state: ViewState) => void;
  setIsGuest: (val: boolean) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ setViewState, setIsGuest }) => {
  const { projects } = useContractState();
  const { getApprovedBarangays } = useAuth();

  const [approvedCount, setApprovedCount] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Load real count from database
  useEffect(() => {
    getApprovedBarangays()
      .then((list) => setApprovedCount(list.length))
      .catch(console.error);
  }, []);

  const handleEnterGuest = () => {
    setIsGuest(true);
    setViewState("dashboard");
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  // Process live statistics from contract states
  const activeCount = projects.filter(p => p.status < 2).length;
  const totalLocked = projects.reduce((sum, p) => sum + Number(p.budget), 0);

  return (
    <div className="landing-page-theme">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <span className="landing-logo">🇵🇭 Barangay Bond</span>
          <div className="landing-nav-actions">
            <button className="btn btn-outline-navy btn-sm" onClick={handleEnterGuest}>
              Public Transparency Catalog
            </button>
            <button className="btn btn-navy btn-sm" onClick={() => setViewState("auth")}>
              Access Portal
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-hero-container">
          <span className="landing-badge">🏆 Stellar Journey To Mastery</span>
          <h1 className="landing-hero-title">
            Transparent Youth Governance.<br />Escrow Auditing on Stellar.
          </h1>
          <p className="landing-hero-subtitle">
            A secure digital governance platform that locks local community budgets in smart contracts. Local youth residents verify completed milestones to release funding tranches.
          </p>
          <div className="landing-hero-ctas">
            <button className="btn btn-navy btn-lg" onClick={() => setViewState("auth")}>
              Join Barangay Bond <ChevronRight size={18} style={{ marginLeft: "0.5rem" }} />
            </button>
            <button className="btn btn-outline-navy btn-lg" onClick={handleEnterGuest}>
              View Live Transparency Feed <Activity size={18} style={{ marginLeft: "0.5rem" }} />
            </button>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="landing-section bg-white-soft">
        <div className="landing-section-container">
          <h2 className="landing-section-title">Live Transparency Registry</h2>
          <p className="landing-section-subtitle">Real-time statistics queried directly from Firestore profiles and Soroban contract states.</p>

          <div className="grid-3 mt-4">
            <div className="stats-card" style={{ alignItems: "center", textAlign: "center" }}>
              <span className="stats-title" style={{ color: "#3b82f6" }}>Barangays Registered</span>
              <span className="stats-value">{approvedCount}</span>
              <span className="stats-desc">Approved participating barangays</span>
            </div>
            <div className="stats-card" style={{ alignItems: "center", textAlign: "center" }}>
              <span className="stats-title" style={{ color: "#f59e0b" }}>Active Escrows</span>
              <span className="stats-value">{activeCount}</span>
              <span className="stats-desc">Milestone budgets currently locked</span>
            </div>
            <div className="stats-card" style={{ alignItems: "center", textAlign: "center" }}>
              <span className="stats-title" style={{ color: "#16a34a" }}>Funds Locked</span>
              <span className="stats-value">{totalLocked} XLM</span>
              <span className="stats-desc">Total committed native Stellar tokens</span>
            </div>
          </div>
        </div>
      </section>

      {/* How Milestone Escrows Work */}
      <section className="landing-section">
        <div className="landing-section-container">
          <h2 className="landing-section-title">How Milestone Escrow Works</h2>
          <p className="landing-section-subtitle">Our 50%-50% tranche release schedule secures public funds against misallocation.</p>

          <div className="timeline-horizontal">
            <div className="timeline-node">
              <div className="timeline-node-dot">1</div>
              <span className="timeline-node-label">Lock Escrow</span>
              <span className="timeline-node-desc">SK Official locks budget and receives 50% upfront.</span>
            </div>
            <div className="timeline-node">
              <div className="timeline-node-dot">2</div>
              <span className="timeline-node-label">Build Phase</span>
              <span className="timeline-node-desc">Milestone 1 constructed by contractors.</span>
            </div>
            <div className="timeline-node">
              <div className="timeline-node-dot">3</div>
              <span className="timeline-node-label">Upload Proof</span>
              <span className="timeline-node-desc">Visual receipts and documents uploaded.</span>
            </div>
            <div className="timeline-node">
              <div className="timeline-node-dot">4</div>
              <span className="timeline-node-label">Youth Vote</span>
              <span className="timeline-node-desc">Verified residents inspect and sign votes.</span>
            </div>
            <div className="timeline-node">
              <div className="timeline-node-dot">5</div>
              <span className="timeline-node-label">Auto-Release</span>
              <span className="timeline-node-desc">Remaining 50% fund released by contract.</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="landing-section bg-white-soft">
        <div className="landing-section-container">
          <h2 className="landing-section-title">Frequently Asked Questions</h2>
          <p className="landing-section-subtitle">Common queries regarding residency rules, voter verification, and gas operations.</p>

          <div className="faq-accordion mt-4">
            <div className="faq-item">
              <button className="faq-question" onClick={() => toggleFaq(0)}>
                <span>Who is eligible to participate and vote?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 0 ? "rotate(180deg)" : "rotate(0)" }} />
              </button>
              {openFaq === 0 && (
                <div className="faq-answer">
                  Youth residents aged 15-30 verified by the Barangay Admin. Overaged or underaged residents automatically register as permanent approved viewers to audit timelines but cannot vote on budget releases.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button className="faq-question" onClick={() => toggleFaq(1)}>
                <span>Why is the Stellar blockchain utilized?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 1 ? "rotate(180deg)" : "rotate(0)" }} />
              </button>
              {openFaq === 1 && (
                <div className="faq-answer">
                  Stellar Soroban smart contracts guarantee decentralized custody of public budgets. Release tranches execute autonomously based on citizen consensus, creating a transparent audit trail with fast settlement speeds and low transaction gas fees.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button className="faq-question" onClick={() => toggleFaq(2)}>
                <span>Are there gas fees for verified resident voting?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 2 ? "rotate(180deg)" : "rotate(0)" }} />
              </button>
              {openFaq === 2 && (
                <div className="faq-answer">
                  Voters require native Testnet XLM to sign contract submissions. The Barangay Admin distributes faucet testnet tokens to linked resident wallets upon identity verification.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-section-container" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "2rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>🇵🇭 Barangay Bond Portal</h3>
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Official Digital Governance Platform for Sangguniang Kabataan.</p>
          </div>
          <div style={{ display: "flex", gap: "3rem" }}>
            <div>
              <h4 style={{ fontSize: "0.9rem", color: "#334155", marginBottom: "0.5rem" }}>Resources</h4>
              <p style={{ color: "#64748b", fontSize: "0.82rem" }}><a href="#" className="proof-link-badge">Privacy Policy</a></p>
              <p style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "0.25rem" }}><a href="#" className="proof-link-badge">Terms of Service</a></p>
            </div>
            <div>
              <h4 style={{ fontSize: "0.9rem", color: "#334155", marginBottom: "0.5rem" }}>Support</h4>
              <p style={{ color: "#64748b", fontSize: "0.82rem" }}>support@barangay.gov</p>
              <p style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "0.25rem" }}>Stellar Testnet Node API</p>
            </div>
          </div>
        </div>
        <p style={{ marginTop: "2.5rem", borderTop: "1px solid #cbd5e1", paddingTop: "1.5rem" }}>Built by Renz Buday (Solo Builder) | Powered by Stellar Soroban</p>
      </footer>
    </div>
  );
};

const AuthPage: React.FC<{ setViewState: (state: ViewState) => void }> = ({ setViewState }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [signUpStep, setSignUpStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [desiredRole, setDesiredRole] = useState<"resident" | "barangay_admin" | "system_admin">("resident");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Identity Verification States
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState("barangay");
  const [idNumber, setIdNumber] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [professionalInfo, setProfessionalInfo] = useState("");
  const [adminReason, setAdminReason] = useState("");

  // Dynamic Barangay list state
  const [approvedBarangays, setApprovedBarangays] = useState<any[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [resRegion, setResRegion] = useState("");
  const [resProvince, setResProvince] = useState("");
  const [resMunicipality, setResMunicipality] = useState("");

  // Barangay Admin Requested Location State
  const [adminReqRegion, setAdminReqRegion] = useState("REGION IV-A (CALABARZON)");
  const [adminReqProvince, setAdminReqProvince] = useState("Cavite");
  const [adminReqMunicipality, setAdminReqMunicipality] = useState("Imus City");
  const [adminReqBarangayName, setAdminReqBarangayName] = useState("");

  // PSGC Cloud API live dataset state for Barangay Admin
  const [psgcRegions, setPsgcRegions] = useState<Array<{ code: string; name: string }>>([]);
  const [psgcProvinces, setPsgcProvinces] = useState<Array<{ code: string; name: string }>>([]);
  const [psgcMunicipalities, setPsgcMunicipalities] = useState<Array<{ code: string; name: string }>>([]);
  const [psgcBarangays, setPsgcBarangays] = useState<Array<{ code: string; name: string }>>([]);
  
  const [selectedPsgcRegionCode, setSelectedPsgcRegionCode] = useState("");
  const [selectedPsgcProvinceCode, setSelectedPsgcProvinceCode] = useState("");
  const [selectedPsgcMunicipalityCode, setSelectedPsgcMunicipalityCode] = useState("");
  const [psgcLoading, setPsgcLoading] = useState(false);

  const [idPhoto, setIdPhoto] = useState("");
  const [selfiePhoto, setSelfiePhoto] = useState("N/A");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [compressing, setCompressing] = useState(false);

  const { signIn, signUp, signUpEmailPassword, getApprovedBarangays, user, profile, executeAIVerification, signOut, authError, clearAuthError } = useAuth();

  // If already authenticated and onboarding, default steps and prefill values
  useEffect(() => {
    if (user && (!profile || profile.status === "onboarding") && user.emailVerified) {
      setIsLogin(false);
      setSignUpStep(3);
      setEmail(user.email || "");
    }
  }, [user, profile]);

  // 1. Fetch Regions on registration display / role selection
  useEffect(() => {
    if (!isLogin && desiredRole === "barangay_admin") {
      setPsgcLoading(true);
      fetch("https://psgc.cloud/api/regions")
        .then((res) => res.json())
        .then((data: Array<{ code: string; name: string }>) => {
          setPsgcRegions(data);
          if (data.length > 0) {
            const calabarzon = data.find((r) => r.code === "0400000000") || data[0];
            setSelectedPsgcRegionCode(calabarzon.code);
            setAdminReqRegion(calabarzon.name);
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching regions from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [isLogin, desiredRole]);

  // 2. Fetch Provinces when selectedPsgcRegionCode changes
  useEffect(() => {
    if (desiredRole === "barangay_admin" && selectedPsgcRegionCode) {
      setPsgcLoading(true);
      const regObj = psgcRegions.find((r) => r.code === selectedPsgcRegionCode);
      if (regObj) setAdminReqRegion(regObj.name);

      fetch(`https://psgc.cloud/api/regions/${selectedPsgcRegionCode}/provinces`)
        .then((res) => res.json())
        .then((provinces: Array<{ code: string; name: string }>) => {
          if (provinces.length > 0) {
            setPsgcProvinces(provinces);
            const defaultProv = provinces.find((p) => p.name.toLowerCase().includes("cavite")) || provinces[0];
            setSelectedPsgcProvinceCode(defaultProv.code);
            setAdminReqProvince(defaultProv.name);
          } else {
            // Region has no provinces (e.g. NCR) -> fetch cities directly
            setPsgcProvinces([{ code: "NCR", name: "Metro Manila" }]);
            setSelectedPsgcProvinceCode("NCR");
            setAdminReqProvince("Metro Manila");

            fetch(`https://psgc.cloud/api/regions/${selectedPsgcRegionCode}/cities-municipalities`)
              .then((res) => res.json())
              .then((cities: Array<{ code: string; name: string }>) => {
                setPsgcMunicipalities(cities);
                if (cities.length > 0) {
                  const defaultCity = cities.find((c) => c.name.toLowerCase().includes("manila")) || cities[0];
                  setSelectedPsgcMunicipalityCode(defaultCity.code);
                  setAdminReqMunicipality(defaultCity.name);
                }
              });
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching provinces from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [selectedPsgcRegionCode, desiredRole, psgcRegions]);

  // 3. Fetch Municipalities when selectedPsgcProvinceCode changes
  useEffect(() => {
    if (desiredRole === "barangay_admin" && selectedPsgcProvinceCode && selectedPsgcProvinceCode !== "NCR") {
      setPsgcLoading(true);
      const provObj = psgcProvinces.find((p) => p.code === selectedPsgcProvinceCode);
      if (provObj) setAdminReqProvince(provObj.name);

      fetch(`https://psgc.cloud/api/provinces/${selectedPsgcProvinceCode}/cities-municipalities`)
        .then((res) => res.json())
        .then((munis: Array<{ code: string; name: string }>) => {
          setPsgcMunicipalities(munis);
          if (munis.length > 0) {
            const defaultMuni = munis.find((m) => m.name.toLowerCase().includes("imus")) || munis[0];
            setSelectedPsgcMunicipalityCode(defaultMuni.code);
            setAdminReqMunicipality(defaultMuni.name);
          } else {
            setSelectedPsgcMunicipalityCode("");
            setAdminReqMunicipality("");
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching municipalities from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [selectedPsgcProvinceCode, desiredRole, psgcProvinces]);

  // 4. Fetch Barangays when selectedPsgcMunicipalityCode changes
  useEffect(() => {
    if (desiredRole === "barangay_admin" && selectedPsgcMunicipalityCode) {
      setPsgcLoading(true);
      const muniObj = psgcMunicipalities.find((m) => m.code === selectedPsgcMunicipalityCode);
      if (muniObj) setAdminReqMunicipality(muniObj.name);

      fetch(`https://psgc.cloud/api/cities-municipalities/${selectedPsgcMunicipalityCode}/barangays`)
        .then((res) => res.json())
        .then((bgys: Array<{ code: string; name: string }>) => {
          setPsgcBarangays(bgys);
          if (bgys.length > 0 && !adminReqBarangayName) {
            setAdminReqBarangayName(bgys[0].name);
          }
          setPsgcLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching barangays from PSGC API:", err);
          setPsgcLoading(false);
        });
    }
  }, [selectedPsgcMunicipalityCode, desiredRole, psgcMunicipalities]);



  // Load approved barangays asynchronously on registration form display
  useEffect(() => {
    if (!isLogin && desiredRole === "resident") {
      setLoadingBarangays(true);
      getApprovedBarangays()
        .then((list) => {
          setApprovedBarangays(list);
          const regs = Array.from(new Set(list.map((b) => b.regionName || "REGION IV-A (CALABARZON)").filter(Boolean))) as string[];
          if (regs.length > 0) {
            const defaultReg = regs[0];
            setResRegion(defaultReg);
            const provs = Array.from(new Set(list.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === defaultReg).map((b) => b.province || b.provinceName).filter(Boolean))) as string[];
            if (provs.length > 0) {
              const defaultProv = provs[0];
              setResProvince(defaultProv);
              const munis = Array.from(new Set(list.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === defaultReg && (b.province || b.provinceName) === defaultProv).map((b) => b.municipality || b.municipalityName).filter(Boolean))) as string[];
              if (munis.length > 0) {
                const defaultMuni = munis[0];
                setResMunicipality(defaultMuni);
                const bgyMatches = list.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === defaultReg && (b.province || b.provinceName) === defaultProv && (b.municipality || b.municipalityName) === defaultMuni);
                setSelectedBarangayId(bgyMatches[0]?.id || "");
              } else {
                setResMunicipality("");
                setSelectedBarangayId("");
              }
            } else {
              setResProvince("");
              setResMunicipality("");
              setSelectedBarangayId("");
            }
          } else {
            setResRegion("");
            setResProvince("");
            setResMunicipality("");
            setSelectedBarangayId("");
          }
          setLoadingBarangays(false);
        })
        .catch((err) => {
          console.error("Failed to fetch participating barangays:", err);
          setError("Failed to load participating barangays. Please refresh the page.");
          setLoadingBarangays(false);
        });
    }
  }, [isLogin, desiredRole]);

  // Sync resident provinces when region changes
  useEffect(() => {
    if (desiredRole === "resident" && approvedBarangays.length > 0 && resRegion) {
      const provs = Array.from(new Set(approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion).map((b) => b.province || b.provinceName).filter(Boolean))) as string[];
      if (provs.length > 0 && !provs.includes(resProvince)) {
        setResProvince(provs[0]);
      }
    }
  }, [resRegion, approvedBarangays]);

  // Sync resident municipalities when province changes
  useEffect(() => {
    if (desiredRole === "resident" && approvedBarangays.length > 0 && resRegion && resProvince) {
      const munis = Array.from(new Set(approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion && (b.province || b.provinceName) === resProvince).map((b) => b.municipality || b.municipalityName).filter(Boolean))) as string[];
      if (munis.length > 0 && !munis.includes(resMunicipality)) {
        setResMunicipality(munis[0]);
      }
    }
  }, [resProvince, resRegion, approvedBarangays]);

  // Sync resident barangays when municipality changes
  useEffect(() => {
    if (desiredRole === "resident" && approvedBarangays.length > 0 && resRegion && resProvince && resMunicipality) {
      const bgys = approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion && (b.province || b.provinceName) === resProvince && (b.municipality || b.municipalityName) === resMunicipality);
      if (bgys.length > 0 && !bgys.some((b) => b.id === selectedBarangayId)) {
        setSelectedBarangayId(bgys[0].id);
      }
    }
  }, [resMunicipality, resProvince, resRegion, approvedBarangays]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      setError(null);
      setLoading(true);
      try {
        await signIn(email, password);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Login failed. Please check credentials.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAuthSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      let registeredProfile: any = null;
      if (desiredRole === "barangay_admin") {
        if (!adminReqBarangayName.trim() || !adminReqMunicipality.trim() || !adminReqProvince.trim()) {
          throw new Error("Please enter your target Barangay Name, Municipality, and Province.");
        }

        const fullAddress = address.trim()
          ? `${address.trim()}, ${adminReqBarangayName.trim()}, ${adminReqMunicipality.trim()}, ${adminReqProvince.trim()}`
          : `${adminReqBarangayName.trim()}, ${adminReqMunicipality.trim()}, ${adminReqProvince.trim()}`;

        registeredProfile = await signUp(
          email,
          password,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          "unassigned",
          adminReqBarangayName.trim(),
          adminReqMunicipality.trim(),
          adminReqProvince.trim(),
          desiredRole,
          mobileNumber,
          fullAddress,
          idType,
          idNumber,
          "N/A",
          professionalInfo,
          adminReason,
          adminReqRegion.trim() || "CALABARZON"
        );
      } else {
        const selectedBgy = approvedBarangays.find((b) => b.id === selectedBarangayId);
        const bgyName = selectedBgy ? (selectedBgy.name || selectedBgy.barangayName) : "Unassigned";
        const muniName = selectedBgy ? (selectedBgy.municipality || selectedBgy.municipalityName || resMunicipality) : resMunicipality;
        const provName = selectedBgy ? (selectedBgy.province || selectedBgy.provinceName || resProvince) : resProvince;

        const fullAddress = address.trim()
          ? `${address.trim()}, ${bgyName}, ${muniName}, ${provName}`
          : `${bgyName}, ${muniName}, ${provName}`;

        registeredProfile = await signUp(
          email,
          password,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          selectedBgy ? selectedBgy.id : "unassigned",
          bgyName,
          muniName || "N/A",
          provName || "N/A",
          desiredRole as "resident",
          mobileNumber,
          fullAddress,
          idType,
          idNumber,
          schoolName || "N/A",
          undefined,
          undefined,
          selectedBgy ? (selectedBgy.regionName || "CALABARZON") : "N/A"
        );
      }

      // Execute AI visual verification with uploaded photos
      if (desiredRole === "resident" || desiredRole === "barangay_admin") {
        await executeAIVerification(idPhoto, selfiePhoto, profilePhoto, registeredProfile);
      }

      setSignUpStep(7);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Registration failed. Please check details.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (signUpStep === 1) {
      if (!email.trim() || !password.trim()) {
        setError("Please enter your email and password.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      setLoading(true);
      signUpEmailPassword(email, password)
        .then(() => {
          setLoading(false);
          // AppController automatically catches status === "pending_email_verification" and renders VerifyEmailScreen
        })
        .catch((err: any) => {
          setError(err.message || "Failed to initiate registration. Please check credentials.");
          setLoading(false);
        });
    } else if (signUpStep === 3) {
      if (desiredRole === "resident" && !selectedBarangayId) {
        setError("Barangay Bond is not yet available in your municipality. Please contact your Barangay Office or System Administrator.");
        return;
      }
      setSignUpStep(4);
    } else if (signUpStep === 4) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first name and last name.");
        return;
      }
      if (!birthdate) {
        setError("Please select your date of birth.");
        return;
      }
      if (!mobileNumber.trim() || !address.trim()) {
        setError("Please enter your mobile number and house/street address.");
        return;
      }
      setSignUpStep(5);
    } else if (signUpStep === 5) {
      if (desiredRole === "barangay_admin") {
        if (!professionalInfo.trim()) {
          setError("Please enter your professional title or current occupation.");
          return;
        }
        if (!adminReason.trim()) {
          setError("Please explain your reason for applying as Barangay Administrator.");
          return;
        }
      }
      setSignUpStep(6);
    } else if (signUpStep === 6) {
      if (!idNumber.trim()) {
        setError("Please enter your Document ID Number.");
        return;
      }
      if (desiredRole === "resident" && idType === "student" && !schoolName.trim()) {
        setError("Please specify the school/university name.");
        return;
      }
      if (!profilePhoto) {
        setError("Please upload your profile photo.");
        return;
      }
      if (!idPhoto) {
        setError("Please upload your government ID photo.");
        return;
      }
      if (desiredRole === "barangay_admin" && (!selfiePhoto || selfiePhoto === "N/A")) {
        setError("Please upload a selfie holding your ID card.");
        return;
      }
      handleAuthSubmit();
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (signUpStep === 3) {
      // Step 3 is the first step of onboarding. They cannot go back to Step 1 (email/password creation) as they are already authenticated.
      return;
    }
    setSignUpStep((prev) => Math.max(prev - 1, 1));
  };

  const isRegistrationDisabled = !isLogin && signUpStep === 3 && desiredRole === "resident" && approvedBarangays.length === 0 && !loadingBarangays;

  const renderSignupWizard = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Wizard progress billboard */}
        <div className="wizard-progress-bar">
          <span className={`step-dot ${signUpStep === 1 ? "active" : ""}`}>1. Account Setup</span>
          <span className={`step-dot ${signUpStep === 3 ? "active" : ""}`}>2. Role / LGU</span>
          <span className={`step-dot ${signUpStep === 4 ? "active" : ""}`}>3. Identity Details</span>
          <span className={`step-dot ${signUpStep === 5 ? "active" : ""}`}>4. Additional Info</span>
          <span className={`step-dot ${signUpStep === 6 ? "active" : ""}`}>5. Verification Docs</span>
        </div>

        {/* Step 1: Security Credentials */}
        {signUpStep === 1 && (
          <div className="wizard-step-container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="e.g. name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="•••••••• (Min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="button"
              className="btn btn-primary w-100"
              style={{ marginTop: "1rem" }}
              disabled={loading}
              onClick={handleNextStep}
            >
              {loading ? "Creating Account..." : "Register & Send Verification Link"}
            </button>
          </div>
        )}

        {/* Step 3: Role and Location */}
        {signUpStep === 3 && (
          <div className="wizard-step-container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="form-group">
              <label>Desired Portal Role</label>
              <select
                className="form-control"
                value={desiredRole}
                onChange={(e) => setDesiredRole(e.target.value as any)}
              >
                <option value="resident">Resident (Voter)</option>
                <option value="barangay_admin">Barangay Admin</option>
              </select>
            </div>

            {desiredRole === "resident" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {loadingBarangays ? (
                  <div style={{ padding: "0.5rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    ⏳ Fetching active Barangay Bond communities...
                  </div>
                ) : approvedBarangays.length === 0 ? (
                  <div className="form-error-msg" style={{ fontSize: "0.85rem", padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px" }}>
                    ⚠️ Barangay Bond is not yet available in your barangay. Please contact your Barangay Office or System Administrator.
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Region</label>
                      <select
                        className="form-control"
                        value={resRegion}
                        onChange={(e) => setResRegion(e.target.value)}
                        required
                      >
                        {Array.from(new Set(approvedBarangays.map((b) => b.regionName || "REGION IV-A (CALABARZON)").filter(Boolean))).map((reg) => (
                          <option key={reg} value={reg}>
                            {reg}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Province</label>
                      <select
                        className="form-control"
                        value={resProvince}
                        onChange={(e) => setResProvince(e.target.value)}
                        required
                      >
                        {Array.from(new Set(approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion).map((b) => b.province || b.provinceName).filter(Boolean))).map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Municipality / City</label>
                      <select
                        className="form-control"
                        value={resMunicipality}
                        onChange={(e) => setResMunicipality(e.target.value)}
                        required
                      >
                        {Array.from(new Set(approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion && (b.province || b.provinceName) === resProvince).map((b) => b.municipality || b.municipalityName).filter(Boolean))).map((muni) => (
                          <option key={muni} value={muni}>
                            {muni}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Barangay Bond Community</label>
                      {approvedBarangays.filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion && (b.province || b.provinceName) === resProvince && (b.municipality || b.municipalityName) === resMunicipality).length === 0 ? (
                        <div className="form-error-msg" style={{ fontSize: "0.85rem", padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px" }}>
                          ⚠️ Barangay Bond is not yet available in your selected municipality. Please contact your Barangay Office or System Administrator.
                        </div>
                      ) : (
                        <select
                          className="form-control"
                          value={selectedBarangayId}
                          onChange={(e) => setSelectedBarangayId(e.target.value)}
                          required
                        >
                          {approvedBarangays
                            .filter((b) => (b.regionName || "REGION IV-A (CALABARZON)") === resRegion && (b.province || b.provinceName) === resProvince && (b.municipality || b.municipalityName) === resMunicipality)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                ✓ {b.name || b.barangayName}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {desiredRole === "barangay_admin" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {psgcLoading && (
                  <div style={{ fontSize: "0.85rem", color: "#38bdf8", fontStyle: "italic", padding: "0.4rem 0.6rem", background: "rgba(56, 189, 248, 0.08)", borderRadius: "6px" }}>
                    🔄 Loading official PSGC geographic data...
                  </div>
                )}

                <div className="form-group">
                  <label>Region</label>
                  <select
                    className="form-control"
                    value={selectedPsgcRegionCode}
                    onChange={(e) => setSelectedPsgcRegionCode(e.target.value)}
                    required
                  >
                    {psgcRegions.map((reg) => (
                      <option key={reg.code} value={reg.code}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Province</label>
                  <select
                    className="form-control"
                    value={selectedPsgcProvinceCode}
                    onChange={(e) => setSelectedPsgcProvinceCode(e.target.value)}
                    required
                  >
                    {psgcProvinces.map((prov) => (
                      <option key={prov.code} value={prov.code}>
                        {prov.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Municipality / City</label>
                  <select
                    className="form-control"
                    value={selectedPsgcMunicipalityCode}
                    onChange={(e) => setSelectedPsgcMunicipalityCode(e.target.value)}
                    required
                  >
                    {psgcMunicipalities.map((muni) => (
                      <option key={muni.code} value={muni.code}>
                        {muni.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Barangay Name to Represent (Search or Type)</label>
                  <input
                    type="text"
                    className="form-control"
                    list="psgc-barangay-suggestions"
                    placeholder="Type or select from PSGC list..."
                    value={adminReqBarangayName}
                    onChange={(e) => setAdminReqBarangayName(e.target.value)}
                    required
                  />
                  <datalist id="psgc-barangay-suggestions">
                    {psgcBarangays.map((bgy) => (
                      <option key={bgy.code} value={bgy.name} />
                    ))}
                  </datalist>
                  <small style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                    💡 Choose from official PSGC suggestions or type custom barangay name.
                  </small>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary w-100"
              style={{ marginTop: "1rem" }}
              disabled={isRegistrationDisabled}
              onClick={handleNextStep}
            >
              Continue to Personal Details
            </button>
            {user && (
              <button
                type="button"
                className="btn btn-outline-danger w-100"
                style={{ marginTop: "0.5rem" }}
                onClick={async () => {
                  await signOut();
                  setViewState("landing");
                }}
              >
                Log Out
              </button>
            )}
          </div>
        )}

        {/* Step 4: Personal Details */}
        {signUpStep === 4 && (
          <div className="wizard-step-container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="grid-2" style={{ gap: "1rem" }}>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Middle Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Santos (Optional)"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: "1rem" }}>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Dela Cruz"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Suffix</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Jr., III (Optional)"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Birthdate</label>
              <input
                type="date"
                className="form-control"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 09171234567"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>House / Street Address</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. House #12, Mabini Street, Phase 2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
              <small style={{ color: "#38bdf8", fontSize: "0.8rem", marginTop: "0.35rem", display: "block" }}>
                {desiredRole === "resident" ? (() => {
                  const selectedBgy = approvedBarangays.find((b) => b.id === selectedBarangayId);
                  const bgyName = selectedBgy ? (selectedBgy.name || selectedBgy.barangayName) : "";
                  const muniName = selectedBgy ? (selectedBgy.municipality || selectedBgy.municipalityName || resMunicipality) : resMunicipality;
                  const provName = selectedBgy ? (selectedBgy.province || selectedBgy.provinceName || resProvince) : resProvince;
                  return (
                    <>📍 Automatically Linked Location: <strong>{bgyName || "Barangay"}, {muniName || "Municipality"}, {provName || "Province"}</strong></>
                  );
                })() : (
                  <>📍 Automatically Linked Location: <strong>{adminReqBarangayName || "Barangay"}, {adminReqMunicipality || "Municipality"}, {adminReqProvince || "Province"}</strong></>
                )}
              </small>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-outline-navy flex-grow" onClick={handlePrevStep}>
                Back
              </button>
              <button type="button" className="btn btn-primary flex-grow" onClick={handleNextStep}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Additional Info */}
        {signUpStep === 5 && (
          <div className="wizard-step-container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {desiredRole === "barangay_admin" ? (
              <>
                <div className="form-group">
                  <label>Professional Information / SK or Barangay Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Barangay Executive Secretary"
                    value={professionalInfo}
                    onChange={(e) => setProfessionalInfo(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Reason for becoming Barangay Admin</label>
                  <textarea
                    className="form-control"
                    placeholder="e.g. To verify local residents, oversee community projects, and audit SK releases."
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid #3b82f6", borderRadius: "12px", padding: "1rem", fontSize: "0.82rem" }}>
                  <span style={{ fontWeight: 700, color: "#2563eb", display: "block", marginBottom: "0.3rem" }}>🎓 Student Notice:</span>
                  <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.4" }}>
                    If you are using a Student ID for verification, you must specify your school or university name below. Otherwise, you can leave it blank.
                  </p>
                </div>

                <div className="form-group">
                  <label>School / University Name (If Student ID)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. University of the Philippines"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                  />
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-outline-navy flex-grow" onClick={handlePrevStep}>
                Back
              </button>
              <button type="button" className="btn btn-primary flex-grow" onClick={handleNextStep}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Identity Document Verification & Uploads */}
        {signUpStep === 6 && (
          <div className="wizard-step-container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid #3b82f6", borderRadius: "12px", padding: "0.85rem 1rem", fontSize: "0.78rem" }}>
              <span style={{ fontWeight: 700, color: "#2563eb", display: "block", marginBottom: "0.3rem" }}>📄 Verification Guidelines:</span>
              <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.3" }}>
                Provide a valid ID matching your details. You will need to upload your Profile Avatar, ID Document scan, and a selfie holding the ID card (Admins only).
              </p>
            </div>

            <div className="form-group">
              <label>Identity Document Type</label>
              <select
                className="form-control"
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                required
              >
                <option value="barangay">Barangay ID (Preferred)</option>
                <option value="student">Student ID</option>
                <option value="national">National ID (PhilSys)</option>
                <option value="passport">Passport</option>
                <option value="driver">Driver's License</option>
                <option value="other">Other government ID</option>
              </select>
            </div>

            <div className="form-group">
              <label>Document ID Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. BGY-2026-98472"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                required
              />
            </div>

            {/* Profile Avatar Upload */}
            <div className="form-group">
              <label style={{ fontWeight: 700 }}>Upload Profile Photo (Avatar)</label>
              <input
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCompressing(true);
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const compressed = await compressImage(reader.result as string);
                      setProfilePhoto(compressed);
                      setCompressing(false);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                required
              />
              {profilePhoto && (
                <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "100px", height: "100px", position: "relative" }}>
                  <img src={profilePhoto} alt="Profile Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
            </div>

            {/* ID Document Photo Upload */}
            <div className="form-group">
              <label style={{ fontWeight: 700 }}>Upload Photo of Government ID</label>
              <input
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCompressing(true);
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const compressed = await compressImage(reader.result as string);
                      setIdPhoto(compressed);
                      setCompressing(false);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                required
              />
              {idPhoto && (
                <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "120px", height: "80px", position: "relative" }}>
                  <img src={idPhoto} alt="ID Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
            </div>

            {/* Selfie Photo Upload (Barangay Admin Only) */}
            {desiredRole === "barangay_admin" && (
              <div className="form-group">
                <label style={{ fontWeight: 700 }}>Upload Selfie Holding ID Card</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setCompressing(true);
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const compressed = await compressImage(reader.result as string);
                        setSelfiePhoto(compressed);
                        setCompressing(false);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  required
                />
                {selfiePhoto && selfiePhoto !== "N/A" && (
                  <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "120px", height: "80px", position: "relative" }}>
                    <img src={selfiePhoto} alt="Selfie Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
              </div>
            )}

            {compressing && (
              <div style={{ color: "var(--primary)", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center" }}>
                ⏳ Compressing images for upload...
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-outline-navy flex-grow" onClick={handlePrevStep} disabled={loading || compressing}>
                Back
              </button>
              <button type="button" className="btn btn-primary flex-grow" onClick={handleNextStep} disabled={loading || compressing}>
                {loading ? "Submitting Audit..." : "Submit Verification Details"}
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Success Screen */}
        {signUpStep === 7 && (
          <div className="wizard-step-container animate-fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1.5rem", padding: "1rem 0" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={36} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>
                Identity Verified & Submitted!
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
                Your email has been verified, and your visual documents have been processed by our AI identity audit system.
              </p>
            </div>

            <div style={{ background: "rgba(241, 245, 249, 0.6)", borderRadius: "12px", padding: "1rem", width: "100%", textAlign: "left", fontSize: "0.8rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.4rem" }}>Review Status:</span>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {desiredRole === "barangay_admin" ? (
                  <li>The System Administrator will verify your credentials and representational request.</li>
                ) : (
                  <li>Your local Sangguniang Kabataan officials will confirm your registration roster details.</li>
                )}
                <li>Once approved, you will have access to full governance and escrow voting functions.</li>
              </ul>
            </div>

            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => {
                setSignUpStep(1);
                setEmail("");
                setPassword("");
                setFirstName("");
                setMiddleName("");
                setLastName("");
                setSuffix("");
                setBirthdate("");
                setMobileNumber("");
                setAddress("");
                setIdNumber("");
                setSchoolName("");
                setIdPhoto("");
                setSelfiePhoto("N/A");
                setProfilePhoto("");
                setIsLogin(true);
              }}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="auth-layout">
      {/* Left visual cover split */}
      <div className="auth-visual-cover">
        <span className="auth-cover-logo">🇵🇭 Barangay Bond</span>
        <div style={{ maxWidth: "480px" }}>
          <h1 className="auth-cover-title">Secure Local Budgets.<br />Empower Barangay Builders.</h1>
          <div className="auth-cover-features">
            <div className="auth-cover-feature">
              <div className="auth-cover-feature-icon"><Lock size={20} /></div>
              <div className="auth-cover-feature-text">
                <h4>Decentralized Escrows</h4>
                <p>Native project allocations are locked inside on-chain escrows, released step-by-step.</p>
              </div>
            </div>
            <div className="auth-cover-feature">
              <div className="auth-cover-feature-icon"><ShieldCheck size={20} /></div>
              <div className="auth-cover-feature-text">
                <h4>Verified Identities</h4>
                <p>Dynamic birthdate validation checks resident profiles and checks voter age limits.</p>
              </div>
            </div>
            <div className="auth-cover-feature">
              <div className="auth-cover-feature-icon"><Camera size={20} /></div>
              <div className="auth-cover-feature-text">
                <h4>Timeline Audit Feeds</h4>
                <p>SK Officials submit receipts and completion proof documents directly to the public catalog.</p>
              </div>
            </div>
          </div>
        </div>
        <span className="auth-cover-footer">Stellar Soroban Testnet Portal</span>
      </div>

      {/* Right card forms */}
      <div className="auth-card">
            <h2 className="auth-title">{isLogin ? "Sign In to Portal" : "Register Resident Profile"}</h2>
            <p className="auth-subtitle">
              {isLogin ? "Access your transparency dashboard" : "Submit credentials to request verification role"}
            </p>

            <ErrorValidationModal
              isOpen={error !== null || authError !== null}
              error={error || authError}
              onClose={() => {
                setError(null);
                clearAuthError();
              }}
              actionText={(error && (error.includes("already-in-use") || error.includes("already in use"))) || (authError && authError.code === "auth/email-already-in-use") ? "Switch to Sign In" : undefined}
              onAction={() => {
                if (error && (error.includes("already-in-use") || error.includes("already in use"))) {
                  setIsLogin(true);
                  setSignUpStep(1);
                }
                if (authError && authError.code === "auth/email-already-in-use") {
                  setIsLogin(true);
                  setSignUpStep(1);
                }
                setError(null);
                clearAuthError();
              }}
            />

            <form onSubmit={handleAuth} className="panel-form">
              {isLogin ? (
                <>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                    {loading ? "Processing..." : "Login"}
                  </button>
                </>
              ) : (
                renderSignupWizard()
              )}
            </form>

            <div className="auth-toggle-row">
              <button className="btn-text-link" onClick={() => { setIsLogin(!isLogin); setSignUpStep(1); setError(null); }}>
                {isLogin ? "Need a new profile? Register here" : "Already have an account? Sign in"}
              </button>
            </div>

            {isLogin && (
              <div style={{ marginTop: "1.5rem", fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center" }}>
                💡 Tip: Register as a <strong>Barangay Admin</strong> to manage residents, or as a <strong>Resident</strong> to vote on projects. System Admin accounts are pre-provisioned.
              </div>
            )}

            <button className="btn-back-landing" onClick={() => setViewState("landing")}>
              ← Back to Landing Page
            </button>
          </div>
    </div>
  );
};

interface StatusScreenProps {
  profile: any;
  onLogout: () => Promise<void>;
}

interface VerificationTimelineProps {
  desiredRole: string;
  email: string;
  barangayName: string;
  runSignUp: () => Promise<any>;
  onComplete: (profile: any) => void;
  onCancel: () => void;
}

const VerificationLoadingTimeline: React.FC<VerificationTimelineProps> = ({
  desiredRole,
  email: _email,
  barangayName: _barangayName,
  runSignUp,
  onComplete,
  onCancel
}) => {
  const { deleteCurrentUserForResubmission } = useAuth();

  const [stages, setStages] = useState<any[]>([
    { id: "account", label: "Creating Barangay Bond account...", status: "pending" },
    { id: "compress", label: "Compressing uploaded documents...", status: "pending" },
    { id: "upload_id", label: "Uploading government ID...", status: "pending" },
    { id: "upload_selfie", label: "Uploading selfie verification...", status: "pending" },
    { id: "security", label: "Running security validation...", status: "pending" },
    { id: "duplicate", label: "Checking duplicate registrations...", status: "pending" },
    { id: "compare", label: "Comparing submitted information...", status: "pending" },
    { id: "ai_read", label: "AI reading government ID...", status: "pending" },
    { id: "ai_address", label: "AI validating barangay address...", status: "pending" },
    { id: "ai_identity", label: "AI validating identity...", status: "pending" },
    { id: "confidence", label: "Calculating verification confidence...", status: "pending" },
    { id: "package", label: "Preparing review package...", status: "pending" },
    { id: "submit", label: "Submitting application...", status: "pending" }
  ]);

  // const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progressScores, setProgressScores] = useState({
    idCard: 0,
    quality: 0,
    identity: 0,
    address: 0,
    duplicate: 0,
    fraud: 0
  });

  const [signupResult, setSignupResult] = useState<any | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;
    let progressTimer: any;
    let promiseResolved = false;
    let resolvedProfile: any = null;
    let resolvedError: any = null;

    runSignUp()
      .then((profile) => {
        promiseResolved = true;
        resolvedProfile = profile;
        logger.info("[Timeline] Background signup promise resolved", "Timeline");
      })
      .catch((err) => {
        promiseResolved = true;
        resolvedError = err;
        logger.error(`[Timeline] Background signup promise failed: ${err.message}`, "Timeline");
      });

    progressTimer = setInterval(() => {
      if (!isActive) return;
      setProgressScores((prev) => {
        if (signupResult) return prev;
        return {
          idCard: Math.min(prev.idCard + Math.floor(Math.random() * 8) + 2, 85),
          quality: Math.min(prev.quality + Math.floor(Math.random() * 8) + 2, 88),
          identity: Math.min(prev.identity + Math.floor(Math.random() * 8) + 2, 90),
          address: Math.min(prev.address + Math.floor(Math.random() * 8) + 2, 78),
          duplicate: Math.min(prev.duplicate + Math.floor(Math.random() * 8) + 2, 95),
          fraud: Math.min(prev.fraud + Math.floor(Math.random() * 8) + 2, 92)
        };
      });
    }, 150);

    const stepTimeline = async () => {
      let index = 0;
      while (index < stages.length) {
        if (!isActive) return;

        if (stages[index].id === "upload_selfie" && desiredRole !== "barangay_admin") {
          setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "skipped" } : s));
          index++;
          continue;
        }

        // setCurrentStageIndex(index);
        setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "running" } : s));

        if (stages[index].id === "ai_read") {
          logger.info("[Timeline] Pausing visual timeline to await Gemini OCR and DB write...", "Timeline");
          while (!promiseResolved) {
            await new Promise((r) => setTimeout(r, 200));
          }
          if (resolvedError) {
            setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "failed" } : s));
            setPipelineError(resolvedError.message || "Onboarding pipeline execution aborted.");
            return;
          }
        }

        await new Promise((r) => setTimeout(r, 650 + Math.random() * 400));

        setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "completed" } : s));
        index++;
      }

      if (resolvedProfile) {
        const finalScores = resolvedProfile.scores || {};
        setProgressScores({
          idCard: finalScores.idNumberMatch || 100,
          quality: finalScores.imageQualityScore || 90,
          identity: finalScores.nameMatch || 95,
          address: finalScores.barangayMatch || 85,
          duplicate: resolvedProfile.duplicateRisk ? 10 : 100,
          fraud: finalScores.documentAuthenticity || 95
        });
        setSignupResult(resolvedProfile);
      }
    };

    stepTimeline();

    return () => {
      isActive = false;
      clearInterval(progressTimer);
    };
  }, []);

  const handleResubmit = async () => {
    setResubmitting(true);
    try {
      await deleteCurrentUserForResubmission();
      onCancel();
    } catch (err: any) {
      alert("Failed to reset credentials: " + err.message);
    } finally {
      setResubmitting(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "#10b981";
    if (score >= 75) return "#f59e0b";
    return "#ef4444";
  };

  const overallScore = signupResult?.scores?.overallScore || (signupResult?.duplicateRisk ? 45 : 85);

  return (
    <div style={{ padding: "1rem", width: "100%", textAlign: "left" }}>
      {!signupResult && !pipelineError ? (
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem", textAlign: "center" }}>
            Identity Audit Pipeline
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", marginBottom: "2rem" }}>
            Analyzing registration dossier, verifying document OCR, and computing duplicate risks.
          </p>

          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-glass)", borderRadius: "16px", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", display: "block", marginBottom: "1rem" }}>
              🧠 AI IDENTITY AUDIT METRICS
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                { label: "Government ID", value: progressScores.idCard },
                { label: "Document Quality", value: progressScores.quality },
                { label: "Identity Match", value: progressScores.identity },
                { label: "Address Match", value: progressScores.address },
                { label: "Duplicate Detection", value: progressScores.duplicate },
                { label: "Fraud Detection", value: progressScores.fraud }
              ].map((bar) => (
                <div key={bar.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem", color: "var(--text-secondary)" }}>
                    <span>{bar.label}</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${bar.value}%`, height: "100%", background: "linear-gradient(90deg, var(--primary-dark), var(--primary))", borderRadius: "3px", transition: "width 0.2s ease" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "180px", overflowY: "auto", paddingRight: "0.5rem" }}>
            {stages.map((stage) => {
              const isRunning = stage.status === "running";
              const isDone = stage.status === "completed";
              const isSkipped = stage.status === "skipped";

              let dotColor = "rgba(0,0,0,0.1)";
              let labelColor = "var(--text-muted)";
              let dotIcon = "•";

              if (isRunning) {
                dotColor = "var(--primary)";
                labelColor = "var(--text-primary)";
                dotIcon = "⏳";
              } else if (isDone) {
                dotColor = "#10b981";
                labelColor = "var(--text-secondary)";
                dotIcon = "✓";
              } else if (isSkipped) {
                dotColor = "rgba(0,0,0,0.05)";
                labelColor = "rgba(0,0,0,0.2)";
                dotIcon = "–";
              }

              return (
                <div
                  key={stage.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.8rem",
                    opacity: isSkipped ? 0.5 : 1
                  }}
                >
                  <span style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: dotColor,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    fontWeight: 700
                  }}>
                    {dotIcon}
                  </span>
                  <span style={{ color: labelColor, fontWeight: isRunning ? 700 : 500 }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : pipelineError ? (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "rgba(220, 38, 38, 0.1)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem auto" }}>
            <AlertTriangle size={30} />
          </div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            Pipeline Interrupted
          </h2>
          <p style={{ color: "#ef4444", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
            {pipelineError}
          </p>
          <button className="btn btn-primary w-100" onClick={onCancel}>
            Return to Form
          </button>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem", textAlign: "center" }}>
            Verification Result
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", marginBottom: "1.5rem" }}>
            Automated visual assessment complete.
          </p>

          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-glass)", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>
              AI CONFIDENCE SCORE
            </span>
            <span style={{ fontSize: "2.8rem", fontWeight: 900, color: getConfidenceColor(overallScore), letterSpacing: "-1px" }}>
              {overallScore}%
            </span>

            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-glass)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>AI Decision:</span>
                <span style={{ fontWeight: 700, color: getConfidenceColor(overallScore) }}>
                  {overallScore >= 90 ? "Low Risk (Auto-Verification Passed)" : overallScore >= 50 ? "Manual Review Required" : "Identity Rejected"}
                </span>
              </div>

              {overallScore >= 90 && (
                <div className="badge badge-success" style={{ margin: "0.4rem auto 0 auto", fontWeight: 700, display: "inline-block" }}>
                  ✓ Verified by AI / Low Risk
                </div>
              )}

              {signupResult.verificationNotes && (
                <div style={{ background: overallScore < 50 ? "rgba(220,38,38,0.05)" : "rgba(245,158,11,0.05)", border: `1px solid ${overallScore < 50 ? "rgba(220,38,38,0.2)" : "rgba(245,158,11,0.2)"}`, borderRadius: "10px", padding: "0.85rem", color: overallScore < 50 ? "#b91c1c" : "#d97706", fontSize: "0.8rem", textAlign: "left", marginTop: "0.85rem" }}>
                  <strong>{overallScore < 50 ? "Auto-Rejection Notice:" : "Audit Remark:"}</strong>
                  <p style={{ margin: "0.2rem 0 0 0", lineHeight: 1.3 }}>
                    {overallScore < 50
                      ? "Your uploaded identification does not sufficiently match the information provided. Please submit a clearer government-issued ID."
                      : signupResult.verificationNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {overallScore >= 50 ? (
            <button className="btn btn-primary w-100" onClick={() => onComplete(signupResult)}>
              Proceed to Dashboard
            </button>
          ) : (
            <button className="btn btn-outline-danger w-100" onClick={handleResubmit} disabled={resubmitting}>
              {resubmitting ? "Resetting Dossier..." : "Resubmit Identification"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface LockedPageProps {
  pageName: string;
  onOpenUnlockDialog: () => void;
}

const LockedPage: React.FC<LockedPageProps> = ({ pageName, onOpenUnlockDialog }) => {
  return (
    <div className="empty-panel-state" style={{ maxWidth: "560px", margin: "4rem auto", padding: "3rem 2rem", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
      <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" }}>{pageName} Locked</h3>
      <p style={{ margin: "1rem 0 1.5rem 0", color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
        Your account is still awaiting verification. Complete the remaining verification steps before accessing this feature.
      </p>
      <button className="btn btn-primary" onClick={onOpenUnlockDialog}>
        View Verification Checklist
      </button>
    </div>
  );
};

interface UnlockDialogProps {
  profile: any;
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const UnlockDialog: React.FC<UnlockDialogProps> = ({ profile, user, isOpen, onClose, onLogout }) => {
  const { sendVerificationEmail, checkEmailVerificationStatus } = useAuth();
  const [checking, setChecking] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    setError(null);
    try {
      await sendVerificationEmail();
      setEmailSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to send verification email.");
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setError(null);
    try {
      const isVerified = await checkEmailVerificationStatus();
      if (!isVerified) {
        setError("Email verification link has not been clicked yet. Please check your inbox and verify.");
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to sync verification status.");
    } finally {
      setChecking(false);
    }
  };

  const isPendingReview = profile?.status === "pending";
  const isPendingEmail = profile?.status === "pending_email_verification";
  const isApproved = profile?.verificationStatus === "approved" || profile?.status === "pending_email_verification" || profile?.status === "active";

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div style={{ maxWidth: "500px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "2.5rem 2rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem", textAlign: "center" }}>
          Governance Verification Status
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", marginBottom: "2rem" }}>
          Barangay Bond governance requires verified residential and email identities.
        </p>

        {error && (
          <div style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "12px", padding: "1rem", color: "#b91c1c", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem", textAlign: "left" }}>
          {[
            { label: "Account Created", done: true },
            { label: "Documents Uploaded", done: true },
            { label: "AI Verification Finished", done: true, extra: `Confidence score: ${profile?.scores?.overallScore || 85}%` },
            { label: "Waiting Barangay Admin Review", done: isApproved, pending: isPendingReview, extra: isApproved ? "Approved by Admin" : "Queued in review roster (24-48h)" },
            { label: "Email Address Verification", done: user?.emailVerified || false, pending: isPendingEmail && !user?.emailVerified, extra: `Register email: ${profile?.email}` },
            { label: "Resident Account Activated", done: profile?.status === "active" }
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <span style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: step.done ? "#10b981" : step.pending ? "var(--primary)" : "rgba(0,0,0,0.05)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginTop: "2px"
              }}>
                {step.done ? "✓" : "⏳"}
              </span>
              <div>
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, color: step.done || step.pending ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {step.label}
                </span>
                {step.extra && (
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{step.extra}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {isPendingEmail && !user?.emailVerified && (
            <>
              {emailSent && (
                <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", padding: "0.75rem", color: "#047857", fontSize: "0.8rem", textAlign: "center" }}>
                  ✉️ Verification email triggered. Check your spam.
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-primary flex-grow" onClick={handleSendEmail} disabled={cooldown > 0}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Activation"}
                </button>
                <button className="btn btn-outline-navy flex-grow" onClick={handleCheckStatus} disabled={checking}>
                  {checking ? "Verifying..." : "Refresh Activation"}
                </button>
              </div>
              <button className="btn btn-outline-navy w-100" onClick={() => window.open("https://mail.google.com")}>
                Open Mail
              </button>
            </>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button className="btn btn-outline-danger flex-grow" onClick={onLogout}>
              Logout
            </button>
            <button className="btn btn-primary flex-grow" onClick={onClose}>
              Close Checklist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatusScreenProps {
  profile: any;
  onLogout: () => Promise<void>;
}

const VerifyEmailScreen: React.FC<StatusScreenProps> = ({ profile, onLogout }) => {
  const { sendVerificationEmail, checkEmailVerificationStatus, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendVerificationEmail();
      setEmailSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const isVerified = await checkEmailVerificationStatus();
      if (!isVerified) {
        setError("Email not verified yet. Please check your inbox and click the verification link first.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify email status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "2rem" }}>
      <div style={{ maxWidth: "520px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "3rem 2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", color: "var(--primary)" }}>
          <Mail size={32} />
        </div>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Activate your Barangay Bond Account</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          Welcome to Barangay Bond! To get started, please verify your email address (<strong>{user?.email || profile?.email}</strong>).
          Once verified, you will be able to log in and upload your identity documents for AI verification.
        </p>

        {error && (
          <div style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "12px", padding: "1rem", color: "#b91c1c", fontSize: "0.85rem", textAlign: "left", marginBottom: "1.5rem" }}>
            {error}
          </div>
        )}

        {emailSent && (
          <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "12px", padding: "1rem", color: "#047857", fontSize: "0.85rem", textAlign: "left", marginBottom: "1.5rem" }}>
            ✉️ Verification email sent! Please check your inbox (including spam folder) for the activation link.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          <button
            className="btn btn-primary w-100"
            onClick={handleSendEmail}
            disabled={loading || cooldown > 0}
          >
            {loading ? "Sending..." : cooldown > 0 ? `Resend Email in ${cooldown}s` : emailSent ? "Resend Activation Email" : "Send Activation Email"}
          </button>

          <button
            className="btn btn-outline-navy w-100"
            onClick={handleCheckStatus}
            disabled={loading}
          >
            {loading ? "Checking..." : "I have verified my email"}
          </button>
        </div>

        <button className="btn btn-outline-danger w-100" onClick={onLogout}>
          <LogOut size={16} style={{ marginRight: "0.5rem" }} /> Log Out
        </button>
      </div>
    </div>
  );
};

interface IdentityUploadScreenProps {
  profile: any;
  onUploadComplete: (idUrl: string, selfieUrl: string, avatarUrl: string) => void;
  onLogout: () => void;
}

const IdentityUploadScreen: React.FC<IdentityUploadScreenProps> = ({ profile, onUploadComplete, onLogout }) => {
  const [idPhoto, setIdPhoto] = useState("");
  const [selfiePhoto, setSelfiePhoto] = useState("N/A");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!idPhoto) {
      setError("Please upload your government ID.");
      return;
    }
    if (profile.requestedRole === "barangay_admin" && (!selfiePhoto || selfiePhoto === "N/A")) {
      setError("Please upload a selfie holding your ID card.");
      return;
    }
    if (!profilePhoto) {
      setError("Please upload your profile photo.");
      return;
    }
    onUploadComplete(idPhoto, selfiePhoto, profilePhoto);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "2rem" }}>
      <div style={{ maxWidth: "560px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "3rem 2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem", textAlign: "center" }}>Complete Identity Verification</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem", textAlign: "center" }}>
          Your email has been verified. Now, please upload your verification photos to trigger the AI identity audit.
        </p>

        {error && (
          <div style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "12px", padding: "1rem", color: "#b91c1c", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            {error}
          </div>
        )}

        {compressing && (
          <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "12px", padding: "1rem", color: "var(--primary)", fontSize: "0.85rem", marginBottom: "1.5rem", textAlign: "center" }}>
            ⏳ Processing and compressing selected photo...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="form-group">
            <label style={{ fontWeight: 700 }}>Upload Profile Photo (Avatar)</label>
            <input
              type="file"
              accept="image/*"
              className="form-control"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCompressing(true);
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const compressed = await compressImage(reader.result as string);
                    setProfilePhoto(compressed);
                    setCompressing(false);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              required
            />
            {profilePhoto && (
              <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "100px", height: "100px", position: "relative" }}>
                <img src={profilePhoto} alt="Profile Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 700 }}>Upload Photo of Government ID</label>
            <input
              type="file"
              accept="image/*"
              className="form-control"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCompressing(true);
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const compressed = await compressImage(reader.result as string);
                    setIdPhoto(compressed);
                    setCompressing(false);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              required
            />
            {idPhoto && (
              <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "120px", height: "80px", position: "relative" }}>
                <img src={idPhoto} alt="ID Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>

          {profile.requestedRole === "barangay_admin" && (
            <div className="form-group">
              <label style={{ fontWeight: 700 }}>Upload Selfie Holding ID Card</label>
              <input
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCompressing(true);
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const compressed = await compressImage(reader.result as string);
                      setSelfiePhoto(compressed);
                      setCompressing(false);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                required
              />
              {selfiePhoto && selfiePhoto !== "N/A" && (
                <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "120px", height: "80px", position: "relative" }}>
                  <img src={selfiePhoto} alt="Selfie Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-outline-danger flex-grow" onClick={onLogout}>
              Logout
            </button>
            <button type="submit" className="btn btn-primary flex-grow" disabled={compressing}>
              Verify Identity with AI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


/*
const PendingApprovalScreen: React.FC<StatusScreenProps> = ({ profile, onLogout }) => {
  const roleLabel = profile?.requestedRole === "barangay_admin" ? "Barangay Admin" : "Resident";
  const approverLabel = profile?.requestedRole === "barangay_admin" ? "System Admin" : "Barangay Admin";
  const submittedDate = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "2rem" }}>
      <div style={{ maxWidth: "520px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "3rem 2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", color: "#d97706" }}>
          <Info size={32} />
        </div>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Application Received</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          Your <strong>{roleLabel}</strong> registration has been submitted and is currently awaiting identity review by the <strong>{approverLabel}</strong>.
        </p>

        <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-glass)", borderRadius: "16px", padding: "1.25rem", textAlign: "left", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Status:</span>
            <span className="badge badge-warning" style={{ fontWeight: 700 }}>PENDING REVIEW</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Current Barangay:</span>
            <span style={{ fontWeight: 700 }}>{profile?.barangayName || "Unassigned"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Submitted:</span>
            <span style={{ fontWeight: 700 }}>{submittedDate}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Estimated Review:</span>
            <span style={{ fontWeight: 700, color: "var(--primary)" }}>1–3 business days</span>
          </div>
        </div>

        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "2rem" }}>
          Residents cannot access governance or blockchain escrow signing features until verified. If you want to audit active projects, you may log out and view the public feed.
        </p>

        <button className="btn btn-outline-danger w-100" onClick={onLogout}>
          <LogOut size={16} style={{ marginRight: "0.5rem" }} /> Log Out
        </button>
      </div>
    </div>
  );
};
*/

const SuspendedScreen: React.FC<StatusScreenProps> = ({ profile, onLogout }) => {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "2rem" }}>
      <div style={{ maxWidth: "480px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "3rem 2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(220, 38, 38, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", color: "#dc2626" }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Account Suspended</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          Your profile (<strong>{profile?.email}</strong>) has been suspended by Barangay Bond administrators due to audit compliance issues or policy violations.
        </p>

        <div style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "12px", padding: "1rem", color: "#b91c1c", fontSize: "0.85rem", textAlign: "left", marginBottom: "2rem" }}>
          <strong>Compliance Notice:</strong> Access to projects, escrows, and community voting rights has been disabled. If you believe this is an error, please reach out to your local Barangay Secretariat.
        </div>

        <button className="btn btn-outline-danger w-100" onClick={onLogout}>
          <LogOut size={16} style={{ marginRight: "0.5rem" }} /> Log Out
        </button>
      </div>
    </div>
  );
};

const ExpiredNoticeScreen: React.FC<{ profile: any; onLogout: () => Promise<void> }> = ({ profile, onLogout }) => {
  const { acknowledgeExpiration } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await acknowledgeExpiration();
    } catch (err: any) {
      alert("Failed to acknowledge expiration: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "2rem" }}>
      <div style={{ maxWidth: "480px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "3rem 2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", color: "#d97706" }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>SK Position Expired</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          Your active term as <strong>SK {profile?.position?.toUpperCase()}</strong> in Barangay {profile?.barangayName} has officially ended on <strong>{profile?.termEnd}</strong>.
        </p>

        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: 1.5 }}>
          Your administrative privileges and project creation modules are now closed. You can proceed to transition your profile back to a standard **Verified Youth Resident** to continue auditing and voting on other community milestones.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button className="btn btn-primary w-100" onClick={handleAcknowledge} disabled={loading}>
            {loading ? "Processing..." : "Acknowledge & Continue as Resident"}
          </button>
          <button className="btn btn-outline-navy w-100" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

const AppController: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>("landing");
  const [isGuest, setIsGuest] = useState(false);
  const { loading, user, profile, authError, signOut, executeAIVerification } = useAuth();
  const { disconnect: disconnectWallet } = useWallet();

  const [isVerifyingPostEmail, setIsVerifyingPostEmail] = useState(false);
  const [tempIdPhoto, setTempIdPhoto] = useState("");
  const [tempSelfiePhoto, setTempSelfiePhoto] = useState("");
  const [tempProfilePhoto, setTempProfilePhoto] = useState("");

  // Log route transitions and authorizations
  useEffect(() => {
    logger.ui(`Route transition: navigating to view = ${viewState.toUpperCase()} (Guest Mode = ${isGuest})`, "AppController");
  }, [viewState, isGuest]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user && !isGuest && viewState !== "landing") {
      setViewState("landing");
      return;
    }

    if (user && !isGuest) {
      if (!profile) {
        if (user.emailVerified && viewState !== "auth") {
          setViewState("auth");
        }
        return;
      }

      if (profile.status === "pending_email_verification" || profile.status === "onboarding") {
        if (viewState !== "auth") {
          setViewState("auth");
        }
        return;
      }

      if (viewState !== "dashboard") {
        setViewState("dashboard");
      }
    }
  }, [loading, user, profile, isGuest, viewState]);

  const handleLogout = async () => {
    try {
      disconnectWallet();
    } catch (e) {
      console.error("Wallet disconnect on logout failed:", e);
    }
    await signOut();
    setIsGuest(false);
    setViewState("landing");
  };

  // If loading user state from firebase
  if (loading) {
    return (
      <div className="full-height-spinner">
        <LoadingSpinner size="lg" label="Restoring profile identity session..." />
      </div>
    );
  }

  // Authentication Gate Status Checks for Logged In users
  if (user && !isGuest) {
    if (!profile) {
      if (!user.emailVerified) {
        return <VerifyEmailScreen profile={null} onLogout={handleLogout} />;
      }
    } else {
      if (profile.status === "pending_email_verification") {
        return <VerifyEmailScreen profile={profile} onLogout={handleLogout} />;
      }
    }
  }

  if (!user && authError && viewState !== "auth") {
    setViewState("auth");
  }

  if (user && !isGuest && viewState === "dashboard") {
    if (!profile) {
      return (
        <div className="full-height-spinner">
          <LoadingSpinner size="lg" label="Loading profile configuration..." />
        </div>
      );
    }

    if (profile.role !== "system_admin" && (profile.idPhotoUrl === "N/A" || !profile.idPhotoUrl)) {
      if (isVerifyingPostEmail) {
        return (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "2rem" }}>
            <div style={{ maxWidth: "560px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "3rem 2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)" }}>
              <VerificationLoadingTimeline
                desiredRole={profile.requestedRole || "resident"}
                email={profile.email}
                barangayName={profile.barangayName}
                runSignUp={async () => {
                  return await executeAIVerification(tempIdPhoto, tempSelfiePhoto, tempProfilePhoto);
                }}
                onComplete={() => {
                  setIsVerifyingPostEmail(false);
                }}
                onCancel={() => {
                  setIsVerifyingPostEmail(false);
                }}
              />
            </div>
          </div>
        );
      }
      return (
        <IdentityUploadScreen
          profile={profile}
          onUploadComplete={(idUrl, selfieUrl, avatarUrl) => {
            setTempIdPhoto(idUrl);
            setTempSelfiePhoto(selfieUrl);
            setTempProfilePhoto(avatarUrl);
            setIsVerifyingPostEmail(true);
          }}
          onLogout={handleLogout}
        />
      );
    }

    // Suspended and Expired accounts are routed to locked full-screens
    if (profile.status === "suspended") {
      return <SuspendedScreen profile={profile} onLogout={handleLogout} />;
    }
    if (profile.status === "expired") {
      return <ExpiredNoticeScreen profile={profile} onLogout={handleLogout} />;
    }
  }

  switch (viewState) {
    case "landing":
      return <LandingPage setViewState={setViewState} setIsGuest={setIsGuest} />;
    case "auth":
      return <AuthPage setViewState={setViewState} />;
    case "dashboard":
      if (!user && !isGuest) {
        setViewState("landing");
        return null;
      }
      return <MainLayout setViewState={setViewState} isGuest={isGuest} setIsGuest={setIsGuest} />;
    default:
      return null;
  }
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WalletProvider>
          <AppController />
          <DevConsole />
        </WalletProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
