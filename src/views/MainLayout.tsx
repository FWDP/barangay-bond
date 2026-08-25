import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useContractState } from "../hooks/useContractState";
import { useWallet } from "../contexts/WalletContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { UnlockDialog } from "../components/UnlockDialog";

// Panel imports
import { AdminPanel } from "../components/AdminPanel";
import { SKWorkspace } from "../components/SKWorkspace";
import { YouthDashboard } from "../components/YouthDashboard";
import { TransparencyHub } from "../components/TransparencyHub";
import { ActivityView } from "../components/ActivityView";
import { ProfileSettingsPanel } from "../components/ProfileSettingsPanel";
import { TransactionLifecycleModal } from "../components/TransactionLifecycleModal";

import { QrModal } from "../components/QrModal";
import { SKCelebrationModal } from "../components/SKCelebrationModal";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { WalletTransactionHistoryModal } from "../components/WalletTransactionHistoryModal";
import { formatXlmToPhp } from "../utils/currency";

import {
  Home,
  Bell,
  User,
  LogOut,
  Info,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  Vote,
  FilePlus,
  CreditCard,
  Sun,
  Moon,
  QrCode,
  ArrowUpRight,
  Receipt,
  ArrowRight
} from "lucide-react";
import type { TransactionStatus } from "../types";

type ViewState = "landing" | "auth" | "dashboard";
type RoleType = "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer";
type MenuKey = "dashboard" | "projects" | "ledger" | "activity" | "profile" | "studio" | "admin";

interface MainLayoutProps {
  setViewState: (state: ViewState) => void;
  isGuest: boolean;
  setIsGuest: (val: boolean) => void;
  onRequestResubmission: (context: any) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  setViewState,
  isGuest: propIsGuest,
  setIsGuest,
  onRequestResubmission
}) => {
  const { projects, eventLogs, loading, xlmBalance } = useContractState();
  const { address } = useWallet();
  const { profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // A logged in user is never in guest mode
  const isGuest = propIsGuest && !user;

  const navigate = useNavigate();
  const location = useLocation();

  // Navigation State & URL Synchronization
  const [activeRole, setActiveRole] = useState<RoleType>("viewer");

  const getMenuFromPath = (pathname: string): MenuKey => {
    if (pathname.includes("/projects") || pathname.includes("/voting") || pathname.includes("/ledger")) return "projects";
    if (pathname.includes("/activity") || pathname.includes("/notifications")) return "activity";
    if (pathname.includes("/profile")) return "profile";
    if (pathname.includes("/studio")) return "studio";
    if (pathname.includes("/admin")) return "admin";
    return "dashboard";
  };

  const activeMenu = getMenuFromPath(location.pathname);

  const navigateToMenu = (menu: MenuKey) => {
    switch (menu) {
      case "dashboard":
        navigate("/dashboard");
        break;
      case "projects":
      case "ledger":
        navigate("/projects");
        break;
      case "activity":
        navigate("/activity");
        break;
      case "profile":
        navigate("/profile");
        break;
      case "studio":
        navigate("/studio");
        break;
      case "admin":
        navigate("/admin");
        break;
    }
  };

  const setActiveMenu = (menu: MenuKey) => navigateToMenu(menu);

  // Balance Visibility Toggle (Digital Bank Privacy Feature)
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    return localStorage.getItem("bgy_hide_balance") === "true";
  });

  const toggleBalancePrivacy = () => {
    setHideBalance((prev) => {
      const next = !prev;
      localStorage.setItem("bgy_hide_balance", String(next));
      return next;
    });
  };

  // Address copy feedback
  const [copiedAddress, setCopiedAddress] = useState(false);
  const handleCopyAddress = (addr: string) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Unlock Dialog
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);

  // QR Pay & Receive Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrModalTab, setQrModalTab] = useState<"receive" | "pay">("receive");

  // Wallet Transaction History & PDF Receipts Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const openQrModal = (tab: "receive" | "pay") => {
    setQrModalTab(tab);
    setIsQrModalOpen(true);
  };

  // Sync simulated role with auth profile role by default
  useEffect(() => {
    if (isGuest) {
      setActiveRole("viewer");
      return;
    }

    if (profile?.role) {
      if (profile.role === "system_admin") {
        setActiveRole("system_admin");
      } else if (profile.role === "barangay_admin") {
        setActiveRole("barangay_admin");
      } else if (profile.role === "sk_official") {
        setActiveRole("sk_official");
      } else if (profile.role === "resident") {
        setActiveRole("resident");
      } else {
        setActiveRole("viewer");
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
    setTxStatus("Pending");
    setTxHash(undefined);
    setTxError(undefined);

    try {
      const hash = await actionFn((status, hash, err) => {
        setTxStatus(status);
        if (hash) setTxHash(hash);
        if (err) setTxError(err);
      });
      setTxStatus("Confirmed");
      setTxHash(hash);
      return hash;
    } catch (err: any) {
      console.error("Action execution failed:", err);
      setTxStatus("Failed");
      setTxError(err?.message || "An unexpected error occurred during execution.");
      throw err;
    }
  };

  const handleCloseTxModal = () => {
    setTxStatus("Idle");
    setTxHash(undefined);
    setTxError(undefined);
  };

  const handleLogout = async () => {
    localStorage.removeItem("bgy_guest_mode");
    setIsGuest(false);
    await signOut();
    setViewState("landing");
  };

  if (loading && projects.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <LoadingSpinner size="lg" label="Connecting to Stellar Soroban Bank Vault..." />
      </div>
    );
  }

  // Role Metadata
  const getRoleMetadata = () => {
    if (isGuest) {
      return {
        title: "Public Explorer",
        tag: "Guest Auditor",
        roleClass: "role-viewer",
      };
    }
    switch (activeRole) {
      case "system_admin":
        return {
          title: "Platform Admin",
          tag: "Root Security",
          roleClass: "role-system_admin",
        };
      case "barangay_admin":
        return {
          title: "Barangay Admin",
          tag: "Treasury Vault",
          roleClass: "role-barangay_admin",
        };
      case "sk_official":
        return {
          title: "SK Official",
          tag: "SK Studio",
          roleClass: "role-sk_official",
        };
      case "resident":
        return {
          title: "Verified Resident",
          tag: "Civic Wallet",
          roleClass: "role-resident",
        };
      default:
        return {
          title: "Public Auditor",
          tag: "Ledger Explorer",
          roleClass: "role-viewer",
        };
    }
  };

  const roleMeta = getRoleMetadata();
  const numBalance = parseFloat(xlmBalance) || 0;
  const phpBalanceText = formatXlmToPhp(numBalance);
  const activeWalletAddress = profile?.walletAddress || address || "";
  const hasWallet = !!activeWalletAddress;
  const activeProjectsCount = projects.filter((p) => p.status < 2).length;

  // Escrows calculation for desktop vault widget
  const totalLockedXlm = projects.reduce((sum, p) => {
    const b = parseFloat(p.budget) || 0;
    if (p.status === 1 || p.status === 2) return sum;
    const mobPct = p.mobilizationPct ?? 50;
    return sum + (b * (100 - mobPct)) / 100;
  }, 0);

  const totalReleasedXlm = projects.reduce((sum, p) => {
    const b = parseFloat(p.budget) || 0;
    if (p.status === 1) return sum + b;
    const mobPct = p.mobilizationPct ?? 50;
    return sum + (b * mobPct) / 100;
  }, 0);

  return (
    <div className={`desktop-bank-shell ${roleMeta.roleClass}`}>
      {/* =========================================================================
          1. PERSISTENT DESKTOP SIDEBAR (LOBSTR / MERCURY / REVOLUT BANKING)
          ========================================================================= */}
      <aside className="bank-sidebar">
        <div className="bank-sidebar-top">
          {/* Brand Header */}
          <div className="bank-sidebar-brand" onClick={() => setActiveMenu("dashboard")}>
            <img
              src="/logo.png"
              alt="Barangay Bond Logo"
              style={{ width: "34px", height: "34px", borderRadius: "10px", objectFit: "contain" }}
            />
            <div>
              <div className="bank-brand-title">Barangay Bond</div>
              <div className="bank-brand-network">
                <span className="pulse-beacon" />
                <span>Live on Stellar</span>
              </div>
            </div>
          </div>

          {/* User Profile Capsule */}
          <div className="bank-sidebar-user-capsule">
            <div className="bank-sidebar-user-top">
              <div className="bank-sidebar-avatar">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : "🇵🇭"}
              </div>
              <div className="bank-sidebar-user-meta">
                <span className="bank-sidebar-user-name" title={profile?.name || "Guest Auditor"}>
                  {profile?.name || "Guest Auditor"}
                </span>
                <span className="bank-sidebar-user-loc" title={profile?.barangayName ? `Brgy. ${profile.barangayName}` : "Stellar Testnet"}>
                  {profile?.barangayName ? `Brgy. ${profile.barangayName}` : "Stellar Testnet"}
                </span>
              </div>
            </div>
            <div className="bank-sidebar-user-bottom">
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>Civic Tier</span>
              <span className="badge badge-role" style={{ fontSize: "0.62rem", padding: "0.15rem 0.45rem" }}>
                {roleMeta.tag}
              </span>
            </div>
          </div>

            {/* Navigation Links (5 Core Tabs + Role Workspace) */}
          <nav className="bank-sidebar-nav">
            {isGuest ? (
              <>
                <button
                  className={`bank-nav-item ${activeMenu === "projects" || activeMenu === "dashboard" ? "active" : ""}`}
                  onClick={() => navigateToMenu("projects")}
                >
                  <div className="bank-nav-left"><Vote size={17} /><span>Explore Projects</span></div>
                  {activeProjectsCount > 0 && (
                    <span className="bank-nav-badge">{activeProjectsCount}</span>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  className={`bank-nav-item ${activeMenu === "dashboard" ? "active" : ""}`}
                  onClick={() => navigateToMenu("dashboard")}
                >
                  <div className="bank-nav-left"><Home size={17} /><span>Home</span></div>
                </button>

                <button
                  className={`bank-nav-item ${activeMenu === "projects" ? "active" : ""}`}
                  onClick={() => navigateToMenu("projects")}
                >
                  <div className="bank-nav-left"><Vote size={17} /><span>Projects</span></div>
                  {activeProjectsCount > 0 && (
                    <span className="bank-nav-badge">{activeProjectsCount}</span>
                  )}
                </button>

                <button
                  className={`bank-nav-item ${activeMenu === "activity" ? "active" : ""}`}
                  onClick={() => navigateToMenu("activity")}
                >
                  <div className="bank-nav-left"><Receipt size={17} /><span>Activity</span></div>
                </button>

                <button
                  className={`bank-nav-item ${activeMenu === "profile" ? "active" : ""}`}
                  onClick={() => navigateToMenu("profile")}
                >
                  <div className="bank-nav-left"><User size={17} /><span>My Account</span></div>
                </button>

                {/* Role Workspace Link (If SK or Admin) */}
                {activeRole === "sk_official" && (
                  <>
                    <div style={{ height: "1px", background: "var(--border-subtle)", margin: "0.4rem 0.5rem" }} />
                    <button
                      className={`bank-nav-item ${activeMenu === "studio" ? "active" : ""}`}
                      onClick={() => navigateToMenu("studio")}
                      style={{ color: "var(--role-accent)" }}
                    >
                      <div className="bank-nav-left"><FilePlus size={17} /><span>SK Studio</span></div>
                    </button>
                  </>
                )}

                {(activeRole === "barangay_admin" || activeRole === "system_admin") && (
                  <>
                    <div style={{ height: "1px", background: "var(--border-subtle)", margin: "0.4rem 0.5rem" }} />
                    <button
                      className={`bank-nav-item ${activeMenu === "admin" ? "active" : ""}`}
                      onClick={() => navigateToMenu("admin")}
                      style={{ color: "var(--role-accent)" }}
                    >
                      <div className="bank-nav-left"><ShieldCheck size={17} /><span>Admin Desk</span></div>
                    </button>
                  </>
                )}
              </>
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="bank-sidebar-footer">
          {activeWalletAddress && !isGuest && (
            <div
              className="bank-sidebar-wallet-chip"
              onClick={() => handleCopyAddress(activeWalletAddress)}
              title="Copy Wallet Address"
            >
              <div>
                <div style={{ fontSize: "0.67rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Linked Wallet</div>
                <code>{activeWalletAddress.slice(0, 6)}...{activeWalletAddress.slice(-4)}</code>
              </div>
              {copiedAddress ? <Check size={14} style={{ color: "var(--accent-green)" }} /> : <Copy size={14} />}
            </div>
          )}

          <button
            className="theme-toggle-btn w-full"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            style={{ width: "100%", height: "38px", display: "flex", gap: "0.5rem", fontSize: "0.8rem", fontWeight: 700 }}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>

          {!isGuest ? (
            <button className="btn btn-outline-danger btn-sm w-100" onClick={handleLogout} style={{ height: "40px" }}>
              <LogOut size={15} /> Sign Out
            </button>
          ) : (
            <button className="btn btn-primary btn-sm w-100" onClick={() => setViewState("auth")} style={{ height: "40px" }}>
              Sign In / Register
            </button>
          )}
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CONTENT VIEWPORT
          ========================================================================= */}
      <main className="bank-main-viewport">
        {/* CLEAN TOP APP BAR */}
        <header className="desktop-top-bar">
          <div className="topbar-left">
            <div className="topbar-page-title">
              {isGuest ? "Public Explorer" :
                activeMenu === "dashboard" ? `Hi, ${profile?.name ? profile.name.split(" ")[0] : "there"} 👋` :
                activeMenu === "projects" ? "Community Projects" :
                activeMenu === "ledger" ? "Public Ledger" :
                activeMenu === "activity" ? "Activity & Receipts" :
                activeMenu === "profile" ? "My Account" :
                activeMenu === "studio" ? "SK Studio" :
                activeMenu === "admin" ? "Admin Desk" : "Barangay Bond"}
            </div>
            <div className="topbar-page-sub">
              {isGuest
                ? "Viewing as guest — sign in to participate"
                : profile?.barangayName
                  ? `Brgy. ${profile.barangayName} · ${roleMeta.tag}`
                  : roleMeta.tag}
            </div>
          </div>

          {/* Right Controls — max 3 items */}
          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {!isGuest && (
              <button
                type="button"
                className={`topbar-icon-btn ${activeMenu === "activity" ? "active" : ""}`}
                onClick={() => setActiveMenu("activity")}
                title="Activity & Notifications"
                style={activeMenu === "activity" ? { borderColor: "var(--role-accent-border)", color: "var(--role-accent)" } : {}}
              >
                <Bell size={17} />
              </button>
            )}

            {!isGuest ? (
              <button
                type="button"
                className="topbar-avatar-btn"
                onClick={() => setActiveMenu("profile")}
                title="My Account"
              >
                {profile?.name ? profile.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "BB"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setViewState("auth")}
                style={{ height: "36px", padding: "0 1.1rem", borderRadius: "10px", fontWeight: 800, fontSize: "0.82rem" }}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* VIEWPORT INNER CONTAINER */}
        <div className="banking-app-container">

          {/* SINGLE CLEAN GUEST MODE BANNER */}
          {isGuest && (
            <div className="section-card" style={{ background: "var(--accent-blue-soft)", border: "1px solid rgba(0,125,254,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", padding: "0.9rem 1.25rem", marginTop: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "rgba(0,125,254,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-blue)", flexShrink: 0 }}>
                  <Info size={17} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-primary)" }}>You're viewing as a guest</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Sign in to vote on milestone deliverables, propose projects, or link your wallet.</div>
                </div>
              </div>
              <button className="btn btn-primary btn-sm tap-scale" onClick={() => setViewState("auth")} style={{ flexShrink: 0, fontWeight: 800 }}>
                Sign In / Register
              </button>
            </div>
          )}

          {/* =========================================================================
              VIEWPORT SWITCHER
              ========================================================================= */}

          {/* 1. DASHBOARD VIEWPORT */}
          {activeMenu === "dashboard" && (
            <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* BALANCE + SUMMARY ROW */}
              <div className="desktop-hero-grid">
                {/* BALANCE CARD */}
                <div className="civic-master-card" style={{ margin: 0 }}>
                  <div className="civic-card-top">
                    <div className="civic-balance-label">
                      <span>{isGuest ? "Total Community Funds" : "Your Balance"}</span>
                      {!isGuest && (
                        <button
                          onClick={toggleBalancePrivacy}
                          title={hideBalance ? "Show balance" : "Hide balance"}
                          style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.15rem" }}
                        >
                          {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                    <div className="civic-card-chip-tag">
                      <CreditCard size={12} /> {roleMeta.tag}
                    </div>
                  </div>

                  <div>
                    <div className="civic-balance-amount">
                      {isGuest
                        ? formatXlmToPhp(totalLockedXlm + totalReleasedXlm)
                        : hideBalance ? "₱ ••••••••" : phpBalanceText}
                    </div>
                    <div className="civic-balance-sub">
                      {isGuest
                        ? `${(totalLockedXlm + totalReleasedXlm).toLocaleString()} XLM · Across All Barangays`
                        : hideBalance ? "Balance hidden" : `≈ ${xlmBalance} XLM on Stellar`}
                    </div>
                  </div>

                  <div className="civic-card-action-bar">
                    {isGuest ? (
                      <>
                        <button type="button" className="civic-card-btn primary tap-scale" onClick={() => setViewState("auth")}>
                          <User size={14} /> Sign In
                        </button>
                        <button type="button" className="civic-card-btn tap-scale" onClick={() => setActiveMenu("projects")}>
                          <Vote size={14} /> Explore Projects
                        </button>
                      </>
                    ) : (
                      <>
                        {hasWallet && (
                          <>
                            <button type="button" className="civic-card-btn primary tap-scale" onClick={() => openQrModal("pay")}>
                              <ArrowUpRight size={14} /> Send
                            </button>
                            <button type="button" className="civic-card-btn tap-scale" onClick={() => openQrModal("receive")}>
                              <QrCode size={14} /> Receive
                            </button>
                          </>
                        )}
                        <button className="civic-card-btn tap-scale" onClick={() => navigateToMenu("projects")}>
                          <Vote size={14} /> Projects ({activeProjectsCount})
                        </button>
                      </>
                    )}
                  </div>
                  {!isGuest && (
                    <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Recent Transactions & Receipts</span>
                      <button
                        type="button"
                        onClick={() => navigateToMenu("activity")}
                        style={{ background: "none", border: "none", color: "var(--role-accent)", fontSize: "0.76rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem" }}
                      >
                        <span>View Activity</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 3 STAT TILES — RIGHT COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div className="stat-tile">
                    <div className="stat-tile-label">Active Projects</div>
                    <div className="stat-tile-value" style={{ color: "var(--role-accent)" }}>{activeProjectsCount}</div>
                    <div className="stat-tile-sub">Ongoing in your barangay</div>
                  </div>

                  <div className="grid-2-equal" style={{ gap: "0.75rem" }}>
                    <div className="stat-tile">
                      <div className="stat-tile-label">Funds Reserved</div>
                      <div className="stat-tile-value" style={{ fontSize: "1.2rem" }}>{totalLockedXlm.toLocaleString()}</div>
                      <div className="stat-tile-sub">XLM · {formatXlmToPhp(totalLockedXlm)}</div>
                    </div>
                    <div className="stat-tile">
                      <div className="stat-tile-label">Funds Released</div>
                      <div className="stat-tile-value" style={{ fontSize: "1.2rem", color: "var(--accent-green)" }}>{totalReleasedXlm.toLocaleString()}</div>
                      <div className="stat-tile-sub">XLM · {formatXlmToPhp(totalReleasedXlm)}</div>
                    </div>
                  </div>

                  <div className="stat-tile" style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="stat-tile-label">Approval Requirement</div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>60% of residents must vote yes to release funds</div>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => setActiveMenu("projects")} style={{ fontSize: "0.75rem", flexShrink: 0 }}>
                      Projects →
                    </button>
                  </div>
                </div>
              </div>

              {/* RECENT PROJECTS HIGHLIGHT */}
              <div>
                <YouthDashboard
                  voterAddress={activeWalletAddress}
                  projects={projects}
                  isGuest={isGuest}
                  onExecute={executeAction}
                  onNavigateAuth={() => setViewState("auth")}
                />
              </div>
            </div>
          )}

          {/* SCREEN: COMMUNITY PROJECTS (CIVIC VOTING & DISCOVERY) */}
          {activeMenu === "projects" && (
            <div className="page-enter" style={{ marginTop: "0.5rem" }}>
              <YouthDashboard
                voterAddress={activeWalletAddress}
                projects={projects}
                isGuest={isGuest}
                onExecute={executeAction}
                onNavigateAuth={() => setViewState("auth")}
              />
            </div>
          )}

          {/* SCREEN: PUBLIC ESCROW LEDGER */}
          {activeMenu === "ledger" && (
            <div className="page-enter" style={{ marginTop: "0.5rem" }}>
              <TransparencyHub
                projects={projects}
                eventLogs={eventLogs}
                userWalletAddress={activeWalletAddress}
              />
            </div>
          )}

          {/* SCREEN: ACTIVITY & RECEIPTS (MERGED NOTIFICATIONS & WALLET TRANSACTIONS) */}
          {activeMenu === "activity" && (
            <div className="page-enter" style={{ marginTop: "0.5rem" }}>
              <ActivityView
                userWalletAddress={activeWalletAddress}
              />
            </div>
          )}

          {/* SCREEN: MY ACCOUNT & ROLE WORKSPACE ENTRY */}
          {activeMenu === "profile" && (
            <div className="page-enter" style={{ marginTop: "0.5rem" }}>
              <ProfileSettingsPanel
                profile={profile}
                xlmBalance={xlmBalance}
                onRequestResubmission={onRequestResubmission}
                onOpenWorkspace={(workspaceKey) => navigateToMenu(workspaceKey === "projects" ? "studio" : "admin")}
              />
            </div>
          )}

          {/* ROLE SCREEN: SK PROPOSAL STUDIO */}
          {activeMenu === "studio" && (
            <div className="page-enter" style={{ marginTop: "0.5rem" }}>
              <SKWorkspace
                skAddress={activeWalletAddress}
                projects={projects}
                onExecute={executeAction}
              />
            </div>
          )}

          {/* ROLE SCREEN: ADMIN OPERATIONS DESK */}
          {activeMenu === "admin" && (
            <div className="page-enter" style={{ marginTop: "0.5rem" }}>
              <AdminPanel
                adminAddress={activeWalletAddress}
                projects={projects}
                onExecute={executeAction}
              />
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
          3. FIXED MOBILE BOTTOM DOCK (STREAMLINED PRIMARY TABS)
          ========================================================================= */}
      <nav className="civic-bottom-dock">
        {isGuest ? (
          <>
            <button
              className={`civic-dock-tab ${activeMenu === "projects" || activeMenu === "dashboard" ? "active" : ""}`}
              onClick={() => navigateToMenu("projects")}
            >
              <Vote size={19} />
              <span>Explore Projects</span>
            </button>

            <button
              className="civic-dock-tab"
              onClick={() => setViewState("auth")}
              style={{ color: "var(--role-accent)", fontWeight: 800 }}
            >
              <User size={19} />
              <span>Sign In</span>
            </button>
          </>
        ) : (
          <>
            <button
              className={`civic-dock-tab ${activeMenu === "dashboard" ? "active" : ""}`}
              onClick={() => navigateToMenu("dashboard")}
            >
              <Home size={19} />
              <span>Home</span>
            </button>

            <button
              className={`civic-dock-tab ${activeMenu === "projects" ? "active" : ""}`}
              onClick={() => navigateToMenu("projects")}
            >
              <Vote size={19} />
              <span>Projects</span>
            </button>

            <button
              className={`civic-dock-tab ${activeMenu === "activity" ? "active" : ""}`}
              onClick={() => navigateToMenu("activity")}
            >
              <Receipt size={19} />
              <span>Activity</span>
            </button>

            <button
              className={`civic-dock-tab ${activeMenu === "profile" ? "active" : ""}`}
              onClick={() => navigateToMenu("profile")}
            >
              <User size={19} />
              <span>Account</span>
            </button>
          </>
        )}
      </nav>

      {/* UNLOCK / VERIFICATION CHECKLIST MODAL */}
      <UnlockDialog
        isOpen={unlockDialogOpen}
        onClose={() => setUnlockDialogOpen(false)}
        profile={profile}
        user={user}
        onLogout={handleLogout}
      />

      {/* TRANSACTION EXECUTION MODAL */}
      <TransactionLifecycleModal
        status={txStatus}
        txHash={txHash}
        error={txError}
        onClose={handleCloseTxModal}
      />

      {/* QR PAY & RECEIVE MODAL */}
      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        userAddress={activeWalletAddress}
        xlmBalance={xlmBalance}
        initialTab={qrModalTab}
        secretKey={profile?.inAppWalletSecret || undefined}
        onExecute={executeAction}
      />

      {/* WALLET TRANSACTION HISTORY & PDF RECEIPT MODAL */}
      <WalletTransactionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        walletAddress={activeWalletAddress}
      />

      {/* NEWLY PROMOTED SK CELEBRATION MODAL */}
      <SKCelebrationModal onOpenSKWorkspace={() => setActiveMenu("projects")} />
    </div>
  );
};

export default MainLayout;
