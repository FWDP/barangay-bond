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
import type { TransactionStatus } from "./types";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { 
  Lock, Camera, CheckSquare, ShieldCheck, UserCheck, Menu, X, AlertTriangle, Info, LogOut, Layout, BookOpen, Settings,
  ChevronDown, ChevronRight, Activity, Bell, User
} from "lucide-react";
import { db } from "./services/firebase";
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from "firebase/firestore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { compressImage } from "./utils/imageCompressor";
import { DevConsole } from "./components/DevConsole";
import { logger } from "./utils/logger";

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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Wallet Management Section */}
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
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>PORTAL ROLE</span>
              <span style={{ fontSize: "1rem", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>
                {profile?.role?.replace("_", " ")}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>IDENTITY VERIFICATION</span>
              <span style={{ fontWeight: 700 }} className={`badge badge-${profile?.verified ? "success" : "warning"}`}>
                {profile?.verified ? "VERIFIED RESIDENT" : "PENDING REVIEW"}
              </span>
            </div>

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
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ setViewState, isGuest, setIsGuest }) => {
  const { projects, eventLogs, loading, xlmBalance, error: stateError } = useContractState();
  const { address, connected, connect } = useWallet();
  const { profile, signOut } = useAuth();

  // Collapsible Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Role Switcher / Simulator Override state (for hackathon testing on localhost)
  const [activeRole, setActiveRole] = useState<RoleType>("viewer");
  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");

  // Stellar L2 Error Toast States
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

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
    if (!isGuest) {
      await signOut();
    }
    setIsGuest(false);
    setViewState("landing");
  };

  const handleRoleSimulate = (role: RoleType) => {
    if (isGuest) return;
    setActiveRole(role);
    if (role === "system_admin") setActiveMenu("admin");
    else if (role === "barangay_admin") setActiveMenu("admin");
    else if (role === "sk_official") setActiveMenu("projects");
    else if (role === "resident") setActiveMenu("voting");
    else setActiveMenu("dashboard");
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

    switch (activeMenu) {
      case "dashboard":
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
        return <AdminPanel adminAddress={address || ""} onExecute={executeAction} />;

      case "notifications":
        if (isGuest) return null;
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
            {isGuest ? "GUEST AUDITOR" : activeRole.replace("_", " ").toUpperCase()}
          </span>
        </div>

        <div className="header-actions-group">
          {/* Switcher is restricted to Localhost Dev environments */}
          {isLocalhost && !isGuest && (
            <div className="role-switcher-dropdown">
              <span className="switcher-label">Dev Switcher:</span>
              <select
                className="form-control switcher-select"
                value={activeRole}
                onChange={(e) => handleRoleSimulate(e.target.value as RoleType)}
              >
                <option value="system_admin">System Admin</option>
                <option value="barangay_admin">Barangay Admin</option>
                <option value="sk_official">SK Official</option>
                <option value="resident">Verified Resident</option>
                <option value="viewer">Unverified (Viewer)</option>
              </select>
            </div>
          )}

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
                onClick={() => { setActiveMenu("voting"); setMobileMenuOpen(false); }}
              >
                <CheckSquare size={20} />
                <span className="nav-label">Milestone Voting</span>
              </button>
            )}

            {/* Admin Console */}
            {!isGuest && (activeRole === "system_admin" || activeRole === "barangay_admin") && (
              <button 
                className={`sidebar-nav-item ${activeMenu === "admin" ? "active" : ""}`}
                onClick={() => { setActiveMenu("admin"); setMobileMenuOpen(false); }}
              >
                <Settings size={20} />
                <span className="nav-label">Admin Console</span>
              </button>
            )}

            {/* Notifications Tab */}
            {!isGuest && (
              <button 
                className={`sidebar-nav-item ${activeMenu === "notifications" ? "active" : ""}`}
                onClick={() => { setActiveMenu("notifications"); setMobileMenuOpen(false); }}
              >
                <Bell size={20} />
                <span className="nav-label">Notifications</span>
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
  const [idPhotoUrl, setIdPhotoUrl] = useState("");
  const [selfiePhotoUrl, setSelfiePhotoUrl] = useState("");
  const [professionalInfo, setProfessionalInfo] = useState("");
  const [adminReason, setAdminReason] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");

  // Dynamic Barangay list state
  const [approvedBarangays, setApprovedBarangays] = useState<any[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [selectedBarangayId, setSelectedBarangayId] = useState("");

  const { signIn, signUp, getApprovedBarangays } = useAuth();

  // Load approved barangays asynchronously on registration form display
  useEffect(() => {
    if (!isLogin && desiredRole === "resident") {
      setLoadingBarangays(true);
      getApprovedBarangays()
        .then((list) => {
          setApprovedBarangays(list);
          if (list.length > 0) {
            setSelectedBarangayId(list[0].id);
          } else {
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        if (desiredRole === "barangay_admin") {
          // Barangay Admins register without a barangay — they'll be assigned one by System Admin
          await signUp(
            email, 
            password, 
            firstName,
            middleName,
            lastName,
            suffix,
            birthdate, 
            "unassigned", 
            "Unassigned", 
            "N/A",
            "N/A",
            desiredRole,
            mobileNumber,
            address,
            idType,
            idNumber,
            "N/A", // schoolName
            idPhotoUrl,
            selfiePhotoUrl,
            professionalInfo,
            adminReason,
            profilePhotoUrl
          );
        } else {
          const selectedBgy = approvedBarangays.find((b) => b.id === selectedBarangayId);
          if (desiredRole === "resident" && !selectedBgy) {
            throw new Error("No approved barangay is selected. Please select one to proceed.");
          }
          await signUp(
            email,
            password,
            firstName,
            middleName,
            lastName,
            suffix,
            birthdate,
            selectedBgy ? selectedBgy.id : "unassigned",
            selectedBgy ? selectedBgy.name : "Unassigned",
            selectedBgy ? (selectedBgy.municipality || "N/A") : "N/A",
            selectedBgy ? (selectedBgy.province || "N/A") : "N/A",
            desiredRole,
            mobileNumber,
            address,
            idType,
            idNumber,
            schoolName || "N/A",
            idPhotoUrl || "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&w=400&q=80",
            undefined,
            undefined,
            undefined,
            profilePhotoUrl
          );
        }
        setSignUpStep(5);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (signUpStep === 1) {
      if (desiredRole === "resident" && !selectedBarangayId) {
        setError("Please select a participating Barangay boundary location.");
        return;
      }
      setSignUpStep(2);
    } else if (signUpStep === 2) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first name and last name.");
        return;
      }
      if (!birthdate) {
        setError("Please select your date of birth.");
        return;
      }
      if (desiredRole === "resident" && (!mobileNumber.trim() || !address.trim())) {
        setError("Please enter residential details and contact phone number.");
        return;
      }
      if (desiredRole === "barangay_admin") {
        if (!mobileNumber.trim() || !address.trim()) {
          setError("Please enter your mobile number and residential address.");
          return;
        }
        if (!professionalInfo.trim()) {
          setError("Please enter your professional title or current occupation.");
          return;
        }
        if (!adminReason.trim()) {
          setError("Please explain your reason for applying as Barangay Administrator.");
          return;
        }
      }
      if ((desiredRole === "resident" || desiredRole === "barangay_admin") && !profilePhotoUrl) {
        setError("Please upload your profile photo to proceed.");
        return;
      }
      if (desiredRole === "resident" || desiredRole === "barangay_admin") {
        setSignUpStep(3);
      } else {
        setSignUpStep(4);
      }
    } else if (signUpStep === 3) {
      if (!idNumber.trim()) {
        setError("Please enter your Document ID Number.");
        return;
      }
      if (desiredRole === "resident" && idType === "student" && !schoolName.trim()) {
        setError("Please specify the school/university name.");
        return;
      }
      if (!idPhotoUrl) {
        setError("Please upload a picture of your document ID for validation.");
        return;
      }
      if (desiredRole === "barangay_admin" && !selfiePhotoUrl) {
        setError("Please upload a selfie holding your ID card.");
        return;
      }
      setSignUpStep(4);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (signUpStep === 4) {
      if (desiredRole === "resident" || desiredRole === "barangay_admin") {
        setSignUpStep(3);
      } else {
        setSignUpStep(2);
      }
    } else {
      setSignUpStep((prev) => Math.max(prev - 1, 1));
    }
  };

  const isRegistrationDisabled = !isLogin && desiredRole === "resident" && approvedBarangays.length === 0 && !loadingBarangays;

  const renderSignupWizard = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Wizard progress billboard */}
        <div className="wizard-progress-bar">
          <span className={`step-dot ${signUpStep >= 1 ? "active" : ""}`}>1. Role / LGU</span>
          <span className={`step-dot ${signUpStep >= 2 ? "active" : ""}`}>2. Identity Details</span>
          {(desiredRole === "resident" || desiredRole === "barangay_admin") && (
            <span className={`step-dot ${signUpStep >= 3 ? "active" : ""}`}>3. Verification Docs</span>
          )}
          <span className={`step-dot ${signUpStep >= 4 ? "active" : ""}`}>4. Security</span>
        </div>

        {/* Step 1: Role and Location */}
        {signUpStep === 1 && (
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
                <option value="system_admin">System Admin</option>
              </select>
            </div>

            {desiredRole === "resident" && (
              <div className="form-group">
                <label>Select Participating Barangay</label>
                {loadingBarangays ? (
                  <div style={{ padding: "0.5rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    ⏳ Fetching approved barangays...
                  </div>
                ) : approvedBarangays.length === 0 ? (
                  <div className="form-error-msg" style={{ fontSize: "0.85rem", padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px" }}>
                    ⚠️ There are currently no approved barangays participating in Barangay Bond. Please contact your LGU.
                  </div>
                ) : (
                  <select
                    className="form-control"
                    value={selectedBarangayId}
                    onChange={(e) => setSelectedBarangayId(e.target.value)}
                    required
                  >
                    {approvedBarangays.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.municipality}, {b.province})
                      </option>
                    ))}
                  </select>
                )}
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
          </div>
        )}

        {/* Step 2: Personal Details */}
        {signUpStep === 2 && (
          <div className="wizard-step-container" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="grid-2" style={{ gap: "1rem" }}>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Juan"
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
                  placeholder="e.g. Santos (Optional)"
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
                  placeholder="e.g. Dela Cruz"
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

            {(desiredRole === "resident" || desiredRole === "barangay_admin") && (
              <div className="form-group">
                <label>Profile Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const compressed = await compressImage(reader.result as string);
                        setProfilePhotoUrl(compressed);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  required={!profilePhotoUrl}
                />
                {profilePhotoUrl && (
                  <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "120px", height: "120px", position: "relative" }}>
                    <img src={profilePhotoUrl} alt="Profile Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <span style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", padding: "0.1rem 0.3rem", borderRadius: "4px", fontSize: "0.6rem", fontWeight: 700 }}>PROFILE OK</span>
                  </div>
                )}
              </div>
            )}

            {desiredRole === "resident" && (
              <>
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
                  <label>Residential Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Unit 4B, 123 Rizal St"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {desiredRole === "barangay_admin" && (
              <>
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
                  <label>Residential Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 123 Rizal Ave, Brgy. San Pascual"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>

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

        {/* Step 3: Identity Document Verification */}
        {signUpStep === 3 && (desiredRole === "resident" || desiredRole === "barangay_admin") && (
          <div className="wizard-step-container" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid #3b82f6", borderRadius: "12px", padding: "0.85rem 1rem", fontSize: "0.78rem" }}>
              <span style={{ fontWeight: 700, color: "#2563eb", display: "block", marginBottom: "0.3rem" }}>📄 Accepted Identity Documents:</span>
              <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.3" }}>
                <strong>Government IDs:</strong> National ID, Barangay ID, Passport, Driver's License, PhilHealth, Postal ID, UMID, PRC, Voter's ID.
              </p>
              <p style={{ margin: "0.3rem 0 0 0", color: "var(--text-secondary)", lineHeight: "1.3" }}>
                <strong>School IDs:</strong> Senior High School, College, or University IDs (must contain student photo, school name, and student number).
              </p>
              <span style={{ display: "block", marginTop: "0.4rem", fontStyle: "italic", color: "#475569", fontWeight: 600 }}>
                ⚠️ Uploaded ID must clearly show your identity and support residency verification within the selected Barangay.
              </span>
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

            {idType === "student" && desiredRole === "resident" && (
              <div className="form-group">
                <label>School / University Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. University of the Philippines"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  required
                />
              </div>
            )}

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

            <div className="form-group">
              <label>Upload Photo of Document ID</label>
              <input
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const compressed = await compressImage(reader.result as string);
                      setIdPhotoUrl(compressed);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                required={!idPhotoUrl}
              />
              {idPhotoUrl && (
                <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "120px", height: "80px", position: "relative" }}>
                  <img src={idPhotoUrl} alt="ID Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", padding: "0.1rem 0.3rem", borderRadius: "4px", fontSize: "0.6rem", fontWeight: 700 }}>PREVIEW</span>
                </div>
              )}
            </div>

            {desiredRole === "barangay_admin" && (
              <div className="form-group">
                <label>Upload Selfie Holding ID Card</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const compressed = await compressImage(reader.result as string);
                        setSelfiePhotoUrl(compressed);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  required={!selfiePhotoUrl}
                />
                {selfiePhotoUrl && (
                  <div className="mt-2" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "120px", height: "80px", position: "relative" }}>
                    <img src={selfiePhotoUrl} alt="Selfie Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <span style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(22, 163, 74, 0.9)", color: "#ffffff", padding: "0.1rem 0.3rem", borderRadius: "4px", fontSize: "0.6rem", fontWeight: 700 }}>SELFIE OK</span>
                  </div>
                )}
              </div>
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

        {/* Step 4: Security Credentials */}
        {signUpStep === 4 && (
          <div className="wizard-step-container" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-outline-navy flex-grow" onClick={handlePrevStep} disabled={loading}>
                Back
              </button>
              <button type="submit" className="btn btn-primary flex-grow" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account & Submit"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Registration Success / Under Review */}
        {signUpStep === 5 && (
          <div className="wizard-step-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1.5rem", padding: "1rem 0" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={36} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>
                Registration Submitted!
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
                Your Barangay Bond registration request was received and is currently under review.
              </p>
            </div>
            
            <div style={{ background: "rgba(241, 245, 249, 0.6)", borderRadius: "12px", padding: "1rem", width: "100%", textAlign: "left", fontSize: "0.8rem", border: "1px solid #e2e8f0" }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.4rem" }}>Next Steps:</span>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {desiredRole === "barangay_admin" ? (
                  <li>System Administrator will review and approve your credentials.</li>
                ) : (
                  <li>Your local Sangguniang Kabataan / Barangay Administrator will verify your document ID.</li>
                )}
                <li>Once approved, you will receive confirmation and can log in with your email.</li>
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
                setIsLogin(true);
              }}
            >
              Return to Login
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

        {error && <div className="form-error-msg mb-4">{error}</div>}

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
  const { loading, user, profile, signOut } = useAuth();

  // Log route transitions and authorizations
  useEffect(() => {
    logger.ui(`Route transition: navigating to view = ${viewState.toUpperCase()} (Guest Mode = ${isGuest})`, "AppController");
  }, [viewState, isGuest]);

  const handleLogout = async () => {
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

  // If already logged in, redirect directly to dashboard
  if (user && viewState === "landing") {
    setViewState("dashboard");
  }

  // Authentication Gate Status Checks for Logged In users
  if (user && !isGuest && viewState === "dashboard") {
    if (!profile) {
      return (
        <div className="full-height-spinner">
          <LoadingSpinner size="lg" label="Loading profile configuration..." />
        </div>
      );
    }

    if (profile.status === "pending") {
      return <PendingApprovalScreen profile={profile} onLogout={handleLogout} />;
    }
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
