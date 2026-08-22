import React, { useState, useEffect } from "react";
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
import { NotificationsPanel } from "../components/NotificationsPanel";
import { ProfileSettingsPanel } from "../components/ProfileSettingsPanel";
import { TransactionLifecycleModal } from "../components/TransactionLifecycleModal";
import { WalletSelector } from "../components/WalletSelector";
import { LoadingSpinner } from "../components/LoadingSpinner";
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
  Building,
  FilePlus,
  Activity,
  CreditCard,
  CheckCircle2,
  FileText,
  Landmark,
  Shield,
  Sun,
  Moon
} from "lucide-react";
import type { TransactionStatus } from "../types";

type ViewState = "landing" | "auth" | "dashboard";
type RoleType = "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer";
type MenuKey = "dashboard" | "projects" | "voting" | "notifications" | "profile" | "admin" | "ledger";

interface MainLayoutProps {
  setViewState: (state: ViewState) => void;
  isGuest: boolean;
  setIsGuest: (val: boolean) => void;
  onRequestResubmission: (context: any) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  setViewState,
  isGuest,
  setIsGuest,
  onRequestResubmission
}) => {
  const { projects, eventLogs, loading, xlmBalance } = useContractState();
  const { address } = useWallet();
  const { profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Navigation State
  const [activeRole, setActiveRole] = useState<RoleType>("viewer");
  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");

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
    await signOut();
    setIsGuest(false);
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
            <div className="bank-brand-crest">
              ðŸ‡µðŸ‡­
            </div>
            <div>
              <div className="bank-brand-title">Barangay Bond</div>
              <div className="bank-brand-network">
                <span className="pulse-beacon" />
                <span>Stellar Soroban Vault</span>
              </div>
            </div>
          </div>

          {/* User Profile Capsule */}
          <div className="bank-sidebar-user-capsule">
            <div className="bank-sidebar-avatar">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : "ðŸ‡µðŸ‡­"}
            </div>
            <div className="bank-sidebar-user-meta">
              <span className="bank-sidebar-user-name">{profile?.name || "Guest Auditor"}</span>
              <span className="bank-sidebar-user-loc">
                {profile?.barangayName ? `Brgy. ${profile.barangayName}` : "Stellar Testnet"}
              </span>
            </div>
            <span className="badge badge-role" style={{ fontSize: "0.62rem", padding: "0.1rem 0.35rem" }}>
              {roleMeta.tag}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="bank-sidebar-nav">
            <div className="bank-nav-section-label">Core Banking</div>

            <button
              className={`bank-nav-item ${activeMenu === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveMenu("dashboard")}
            >
              <div className="bank-nav-left">
                <Home size={18} />
                <span>Dashboard</span>
              </div>
            </button>

            <button
              className={`bank-nav-item ${activeMenu === "voting" ? "active" : ""}`}
              onClick={() => setActiveMenu("voting")}
            >
              <div className="bank-nav-left">
                <Vote size={18} />
                <span>Civic Voting</span>
              </div>
              {activeProjectsCount > 0 && (
                <span className="bank-nav-badge">{activeProjectsCount}</span>
              )}
            </button>

            <button
              className={`bank-nav-item ${activeMenu === "ledger" ? "active" : ""}`}
              onClick={() => setActiveMenu("ledger")}
            >
              <div className="bank-nav-left">
                <Landmark size={18} />
                <span>Treasury & Ledger</span>
              </div>
            </button>

            {/* Governance Workspaces */}
            {activeRole === "sk_official" && (
              <>
                <div className="bank-nav-section-label">SK Studio</div>
                <button
                  className={`bank-nav-item ${activeMenu === "projects" ? "active" : ""}`}
                  onClick={() => setActiveMenu("projects")}
                >
                  <div className="bank-nav-left">
                    <FilePlus size={18} />
                    <span>Project Studio</span>
                  </div>
                </button>
              </>
            )}

            {(activeRole === "barangay_admin" || activeRole === "system_admin") && (
              <>
                <div className="bank-nav-section-label">Administration</div>
                <button
                  className={`bank-nav-item ${activeMenu === "admin" ? "active" : ""}`}
                  onClick={() => setActiveMenu("admin")}
                >
                  <div className="bank-nav-left">
                    <ShieldCheck size={18} />
                    <span>Admin Desk</span>
                  </div>
                </button>
              </>
            )}

            <div className="bank-nav-section-label">Account & Security</div>

            <button
              className="bank-nav-item"
              onClick={() => setUnlockDialogOpen(true)}
            >
              <div className="bank-nav-left">
                <CheckCircle2 size={18} />
                <span>Voter Tier Status</span>
              </div>
            </button>

            <button
              className={`bank-nav-item ${activeMenu === "notifications" ? "active" : ""}`}
              onClick={() => setActiveMenu("notifications")}
            >
              <div className="bank-nav-left">
                <Bell size={18} />
                <span>Alerts</span>
              </div>
            </button>

            <button
              className={`bank-nav-item ${activeMenu === "profile" ? "active" : ""}`}
              onClick={() => setActiveMenu("profile")}
            >
              <div className="bank-nav-left">
                <User size={18} />
                <span>Account Settings</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="bank-sidebar-footer">
          {activeWalletAddress && (
            <div
              className="bank-sidebar-wallet-chip"
              onClick={() => handleCopyAddress(activeWalletAddress)}
              title="Copy Linked Wallet Address"
            >
              <div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>LINKED WALLET</div>
                <code>{activeWalletAddress.slice(0, 6)}...{activeWalletAddress.slice(-4)}</code>
              </div>
              {copiedAddress ? <Check size={14} style={{ color: "var(--accent-green)" }} /> : <Copy size={14} />}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
            <button
              className="theme-toggle-btn w-full"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              style={{ width: "100%", height: "38px", display: "flex", gap: "0.5rem", fontSize: "0.8rem", fontWeight: 700 }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
            </button>
          </div>

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
        {/* TOP APP BAR (BREADCRUMB + CONTROLS) */}
        <header className="desktop-top-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {activeMenu === "dashboard" && (profile?.name ? `Welcome back, ${profile.name.split(" ")[0]}` : "Financial Dashboard")}
                {activeMenu === "voting" && "Milestone Governance & Civic Voting"}
                {activeMenu === "projects" && "SK Grant & Proposal Studio"}
                {activeMenu === "admin" && "Barangay Operations & KYC Desk"}
                {activeMenu === "ledger" && "Public Treasury & On-Chain Statement"}
                {activeMenu === "notifications" && "Governance & Audit Alerts"}
                {activeMenu === "profile" && "Account & Stellar Security"}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                {profile?.barangayName ? `Jurisdiction: Barangay ${profile.barangayName}` : "Public Ledger Explorer"}
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <WalletSelector balance={xlmBalance} />

            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              className={`btn btn-outline btn-sm ${activeMenu === "notifications" ? "active" : ""}`}
              onClick={() => setActiveMenu("notifications")}
              style={{ padding: "0.45rem", minHeight: "38px", minWidth: "38px", borderRadius: "12px" }}
              title="Notifications"
            >
              <Bell size={16} />
            </button>

            {!isGuest ? (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={handleLogout}
                style={{ padding: "0.45rem 0.75rem", minHeight: "38px", borderRadius: "12px" }}
                title="Logout"
              >
                <LogOut size={15} />
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setViewState("auth")}
                style={{ minHeight: "38px", borderRadius: "12px" }}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* VIEWPORT INNER CONTAINER */}
        <div className="banking-app-container">
          {/* GUEST MODE BANNER */}
          {isGuest && (
            <div className="fintech-banner-card" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "var(--accent-blue-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-blue)" }}>
                  <Info size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>Public Auditor Mode</strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Sign in or register as a resident to unlock milestone voting and escrow governance.
                  </p>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setViewState("auth")}>
                Join Now
              </button>
            </div>
          )}

          {/* =========================================================================
              SCREEN: DASHBOARD (HOME)
              ========================================================================= */}
          {activeMenu === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.45rem", marginTop: "1.25rem" }}>
              {/* DESKTOP 2-COLUMN HERO SECTION (MASTER BALANCE + VAULT METRICS) */}
              <div className="desktop-hero-grid">
                {/* 1. MAYA / GCASH MASTER BALANCE CARD */}
                <div className="maya-master-card" style={{ margin: 0 }}>
                  <div className="maya-card-top">
                    <div className="maya-balance-label">
                      <span>Available Governance Balance</span>
                      <button
                        onClick={toggleBalancePrivacy}
                        style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.15rem" }}
                        title={hideBalance ? "Reveal balance" : "Hide balance"}
                      >
                        {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <div className="maya-card-chip-tag">
                      <CreditCard size={13} /> {roleMeta.tag}
                    </div>
                  </div>

                  <div>
                    <div className="maya-balance-amount">
                      {hideBalance ? "₱ ••••••••" : phpBalanceText}
                    </div>
                    <div className="maya-balance-sub">
                      {hideBalance ? "••••••" : `≈ ${xlmBalance} XLM (Soroban Escrow)`}
                    </div>
                  </div>

                  {/* Primary Action Ribbon Inside Card */}
                  <div className="maya-card-action-bar">
                    {activeRole === "resident" && (
                      <button className="maya-card-btn primary" onClick={() => setActiveMenu("voting")}>
                        <Vote size={15} /> Cast Vote ({activeProjectsCount})
                      </button>
                    )}

                    {activeRole === "sk_official" && (
                      <button className="maya-card-btn primary" onClick={() => setActiveMenu("projects")}>
                        <FilePlus size={15} /> Propose Project
                      </button>
                    )}

                    {(activeRole === "barangay_admin" || activeRole === "system_admin") && (
                      <button className="maya-card-btn primary" onClick={() => setActiveMenu("admin")}>
                        <ShieldCheck size={15} /> Review KYC
                      </button>
                    )}

                    {activeWalletAddress && (
                      <button
                        className="maya-card-btn"
                        onClick={() => handleCopyAddress(activeWalletAddress)}
                        title="Copy Linked Wallet Address"
                      >
                        <code>{activeWalletAddress.slice(0, 5)}...{activeWalletAddress.slice(-4)}</code>
                        {copiedAddress ? <Check size={13} style={{ color: "var(--accent-green)" }} /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. REVOLUT / LOBSTR DESKTOP VAULT SUMMARY CARD */}
                <div className="bank-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div className="bank-card-header" style={{ marginBottom: "0.75rem" }}>
                    <div>
                      <div className="bank-card-title" style={{ fontSize: "1.05rem" }}>Treasury Escrows Status</div>
                      <div className="bank-card-subtitle">On-Chain Smart Contract Reserves</div>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>
                      <Landmark size={12} /> Testnet Live
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                    <div style={{ background: "var(--bg-elevated)", padding: "0.85rem", borderRadius: "14px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>Locked in Escrow</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "var(--accent-green)", marginTop: "0.2rem" }}>
                        {totalLockedXlm.toLocaleString()} XLM
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                        ≈ {formatXlmToPhp(totalLockedXlm)}
                      </div>
                    </div>

                    <div style={{ background: "var(--bg-elevated)", padding: "0.85rem", borderRadius: "14px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase" }}>Disbursed Funds</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "var(--text-primary)", marginTop: "0.2rem" }}>
                        {totalReleasedXlm.toLocaleString()} XLM
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                        ≈ {formatXlmToPhp(totalReleasedXlm)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Shield size={14} style={{ color: "var(--role-accent)" }} />
                      <span>Consensus Quorum: <strong>60% Required</strong></span>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => setActiveMenu("ledger")} style={{ fontSize: "0.75rem", padding: "0.35rem 0.7rem" }}>
                      Full Ledger â†’
                    </button>
                  </div>
                </div>
              </div>

              {/* 4-COLUMN DISTINCT BANKING SERVICES HUB */}
              <div className="fintech-service-matrix">
                {activeRole === "resident" && (
                  <>
                    <button className="fintech-service-tile" onClick={() => setActiveMenu("voting")}>
                      <div className="fintech-service-icon-box">
                        <Vote size={22} />
                      </div>
                      <span className="fintech-service-label">Civic Vote</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setActiveMenu("ledger")}>
                      <div className="fintech-service-icon-box">
                        <Landmark size={22} />
                      </div>
                      <span className="fintech-service-label">Treasury</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setUnlockDialogOpen(true)}>
                      <div className="fintech-service-icon-box">
                        <CheckCircle2 size={22} />
                      </div>
                      <span className="fintech-service-label">Voter Status</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setViewState("landing")}>
                      <div className="fintech-service-icon-box">
                        <Info size={22} />
                      </div>
                      <span className="fintech-service-label">About Portal</span>
                    </button>
                  </>
                )}

                {activeRole === "sk_official" && (
                  <>
                    <button className="fintech-service-tile" onClick={() => setActiveMenu("projects")}>
                      <div className="fintech-service-icon-box">
                        <FilePlus size={22} />
                      </div>
                      <span className="fintech-service-label">SK Studio</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setActiveMenu("projects")}>
                      <div className="fintech-service-icon-box">
                        <FileText size={22} />
                      </div>
                      <span className="fintech-service-label">Upload Proof</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setActiveMenu("ledger")}>
                      <div className="fintech-service-icon-box">
                        <Landmark size={22} />
                      </div>
                      <span className="fintech-service-label">Treasury</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setViewState("landing")}>
                      <div className="fintech-service-icon-box">
                        <Info size={22} />
                      </div>
                      <span className="fintech-service-label">About Portal</span>
                    </button>
                  </>
                )}

                {(activeRole === "barangay_admin" || activeRole === "system_admin") && (
                  <>
                    <button className="fintech-service-tile" onClick={() => setActiveMenu("admin")}>
                      <div className="fintech-service-icon-box">
                        <ShieldCheck size={22} />
                      </div>
                      <span className="fintech-service-label">KYC Review</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setActiveMenu("admin")}>
                      <div className="fintech-service-icon-box">
                        <Building size={22} />
                      </div>
                      <span className="fintech-service-label">Deploy Escrows</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setActiveMenu("ledger")}>
                      <div className="fintech-service-icon-box">
                        <Landmark size={22} />
                      </div>
                      <span className="fintech-service-label">Treasury</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setViewState("landing")}>
                      <div className="fintech-service-icon-box">
                        <Info size={22} />
                      </div>
                      <span className="fintech-service-label">About Portal</span>
                    </button>
                  </>
                )}

                {activeRole === "viewer" && (
                  <>
                    <button className="fintech-service-tile" onClick={() => setActiveMenu("ledger")}>
                      <div className="fintech-service-icon-box">
                        <Landmark size={22} />
                      </div>
                      <span className="fintech-service-label">Treasury</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setActiveMenu("voting")}>
                      <div className="fintech-service-icon-box">
                        <Vote size={22} />
                      </div>
                      <span className="fintech-service-label">Auditing Feed</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setViewState("auth")}>
                      <div className="fintech-service-icon-box">
                        <CheckCircle2 size={22} />
                      </div>
                      <span className="fintech-service-label">Register</span>
                    </button>

                    <button className="fintech-service-tile" onClick={() => setViewState("landing")}>
                      <div className="fintech-service-icon-box">
                        <Info size={22} />
                      </div>
                      <span className="fintech-service-label">About Portal</span>
                    </button>
                  </>
                )}
              </div>

              {/* PUBLIC TRANSPARENCY & STATEMENT LEDGER COMPONENT */}
              <TransparencyHub projects={projects} eventLogs={eventLogs} />
            </div>
          )}

          {/* =========================================================================
              SCREEN: CIVIC VOTING WORKSPACE
              ========================================================================= */}
          {activeMenu === "voting" && (
            <div style={{ marginTop: "1.25rem" }}>
              <YouthDashboard
                voterAddress={activeWalletAddress}
                projects={projects}
                onExecute={executeAction}
              />
            </div>
          )}

          {/* =========================================================================
              SCREEN: SK PROPOSAL STUDIO WORKSPACE
              ========================================================================= */}
          {activeMenu === "projects" && (
            <div style={{ marginTop: "1.25rem" }}>
              <SKWorkspace
                skAddress={activeWalletAddress}
                projects={projects}
                onExecute={executeAction}
              />
            </div>
          )}

          {/* =========================================================================
              SCREEN: ADMIN OPERATIONS / KYC REVIEW DESK
              ========================================================================= */}
          {activeMenu === "admin" && (
            <div style={{ marginTop: "1.25rem" }}>
              <AdminPanel
                adminAddress={activeWalletAddress}
                projects={projects}
                onExecute={executeAction}
              />
            </div>
          )}

          {/* =========================================================================
              SCREEN: TREASURY STATEMENT / LEDGER
              ========================================================================= */}
          {activeMenu === "ledger" && (
            <div style={{ marginTop: "1.25rem" }}>
              <TransparencyHub projects={projects} eventLogs={eventLogs} />
            </div>
          )}

          {/* =========================================================================
              SCREEN: ALERTS / NOTIFICATIONS INBOX
              ========================================================================= */}
          {activeMenu === "notifications" && (
            <div style={{ marginTop: "1.25rem" }}>
              <NotificationsPanel profile={profile} />
            </div>
          )}

          {/* =========================================================================
              SCREEN: ACCOUNT / PROFILE & WALLET SETTINGS
              ========================================================================= */}
          {activeMenu === "profile" && (
            <div style={{ marginTop: "1.25rem" }}>
              <ProfileSettingsPanel
                profile={profile}
                xlmBalance={xlmBalance}
                onRequestResubmission={onRequestResubmission}
              />
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
          3. FIXED 5-TAB MOBILE BOTTOM DOCK (ACTIVE ONLY ON < 1024PX SCREENS)
          ========================================================================= */}
      <nav className="maya-bottom-dock">
        <button
          className={`maya-dock-tab ${activeMenu === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveMenu("dashboard")}
        >
          <Home size={19} />
          <span>Home</span>
        </button>

        <button
          className={`maya-dock-tab ${activeMenu === "ledger" ? "active" : ""}`}
          onClick={() => setActiveMenu("ledger")}
        >
          <Activity size={19} />
          <span>Ledger</span>
        </button>

        {/* Center Floating Action Circle (Role-Based Primary Workspace) */}
        <button
          className="maya-dock-tab center-action"
          onClick={() => {
            if (activeRole === "sk_official") setActiveMenu("projects");
            else if (activeRole === "barangay_admin" || activeRole === "system_admin") setActiveMenu("admin");
            else setActiveMenu("voting");
          }}
        >
          <div className="maya-dock-center-circle">
            {activeRole === "sk_official" ? <FilePlus size={22} /> : activeRole === "barangay_admin" ? <ShieldCheck size={22} /> : <Vote size={22} />}
          </div>
          <span style={{ marginTop: "2px", fontWeight: 800 }}>
            {activeRole === "sk_official" ? "Studio" : activeRole === "barangay_admin" ? "Admin" : "Vote"}
          </span>
        </button>

        <button
          className={`maya-dock-tab ${activeMenu === "notifications" ? "active" : ""}`}
          onClick={() => setActiveMenu("notifications")}
        >
          <Bell size={19} />
          <span>Alerts</span>
        </button>

        <button
          className={`maya-dock-tab ${activeMenu === "profile" ? "active" : ""}`}
          onClick={() => setActiveMenu("profile")}
        >
          <User size={19} />
          <span>Account</span>
        </button>
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
    </div>
  );
};

export default MainLayout;
