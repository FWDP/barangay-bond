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
  Lock, Camera, CheckSquare, ShieldCheck, Cpu, Database, RefreshCw, 
  ArrowRight, Users, UserCheck, Menu, X, AlertTriangle, Info, LogOut, Layout, BookOpen, Settings
} from "lucide-react";

type ViewState = "landing" | "auth" | "dashboard";
type RoleType = "system_admin" | "admin" | "sk" | "youth" | "viewer";
type MenuKey = "transparency" | "voters" | "projects" | "propose" | "verify" | "system" | "logs";

const MainLayout: React.FC<{ setViewState: (state: ViewState) => void }> = ({ setViewState }) => {
  const { projects, eventLogs, loading, xlmBalance, error: stateError } = useContractState();
  const { address, connected, connect } = useWallet();
  const { profile, signOut, proposeBarangay, approveBarangay, getAllBarangays } = useAuth();

  // Collapsible Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Role Switcher / Simulator Override state (for hackathon testing)
  const [activeRole, setActiveRole] = useState<RoleType>("viewer");
  const [activeMenu, setActiveMenu] = useState<MenuKey>("transparency");

  // Stellar L2 Error Toast States
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Barangay Registry States
  const [allBarangays, setAllBarangays] = useState<any[]>([]);
  const [bgyName, setBgyName] = useState("");
  const [bgyMuni, setBgyMuni] = useState("");
  const [bgyProv, setBgyProv] = useState("");
  const [submittingBgy, setSubmittingBgy] = useState(false);

  // Sync simulated role with auth profile role by default
  useEffect(() => {
    if (profile?.role) {
      if (profile.role === "admin") {
        setActiveRole("admin");
        setActiveMenu("verify");
      } else if (profile.role === "sk") {
        setActiveRole("sk");
        setActiveMenu("projects");
      } else if (profile.role === "youth") {
        setActiveRole("youth");
        setActiveMenu("voters");
      } else {
        setActiveRole("viewer");
        setActiveMenu("transparency");
      }
    }
  }, [profile]);

  const loadAllBarangays = async () => {
    try {
      const list = await getAllBarangays();
      setAllBarangays(list);
    } catch (err) {
      console.error("Failed to load barangays:", err);
    }
  };

  useEffect(() => {
    if (activeRole === "system_admin" && (activeMenu === "system" || activeMenu === "logs")) {
      loadAllBarangays();
    }
  }, [activeRole, activeMenu]);

  const handleProposeBgy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgyName || !bgyMuni || !bgyProv) return;
    setSubmittingBgy(true);
    try {
      await proposeBarangay(bgyName, bgyMuni, bgyProv);
      setBgyName("");
      setBgyMuni("");
      setBgyProv("");
      await loadAllBarangays();
      alert("Barangay proposal created successfully!");
    } catch (err: any) {
      alert("Failed to submit proposal: " + err.message);
    } finally {
      setSubmittingBgy(false);
    }
  };

  const handleApproveBgy = async (id: string) => {
    try {
      await approveBarangay(id);
      await loadAllBarangays();
      alert("Barangay approved successfully! It is now selectable in registration dropdowns.");
    } catch (err: any) {
      alert("Failed to approve: " + err.message);
    }
  };

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
    await signOut();
    setViewState("landing");
  };

  // Switcher handler
  const handleRoleSimulate = (role: RoleType) => {
    setActiveRole(role);
    if (role === "system_admin") setActiveMenu("system");
    else if (role === "admin") setActiveMenu("verify");
    else if (role === "sk") setActiveMenu("projects");
    else if (role === "youth") setActiveMenu("voters");
    else setActiveMenu("transparency");
  };

  // Dynamic Class accents mapping
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
      case "admin":
        return {
          theme: "theme-blue",
          accent: "text-blue-400",
          bg: "bg-blue-600",
          border: "border-blue-500",
          glow: "rgba(59, 130, 246, 0.25)"
        };
      case "sk":
        return {
          theme: "theme-amber",
          accent: "text-amber-400",
          bg: "bg-amber-500",
          border: "border-amber-500",
          glow: "rgba(245, 158, 11, 0.25)"
        };
      case "youth":
        return {
          theme: "theme-teal",
          accent: "text-teal-400",
          bg: "bg-teal-500",
          border: "border-teal-500",
          glow: "rgba(20, 241, 149, 0.25)"
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

  // Role Action notices
  const renderBannerNotice = () => {
    switch (activeRole) {
      case "system_admin":
        return (
          <div className="banner-notice bg-emerald-soft border-emerald text-emerald-light mb-4">
            <Settings size={20} />
            <span><strong>System Control Mode:</strong> Configure global parameters, monitor Testnet RPC nodes, and audit platform parameters.</span>
          </div>
        );
      case "admin":
        return (
          <div className="banner-notice bg-blue-soft border-blue text-blue-light mb-4">
            <UserCheck size={20} />
            <span><strong>Barangay Admin Panel:</strong> Audit profile registrations and execute on-chain voter activations.</span>
          </div>
        );
      case "sk":
        return (
          <div className="banner-notice bg-amber-soft border-amber text-amber-light mb-4">
            <Info size={20} />
            <span><strong>SK Official Workspace:</strong> Propose local budgets, commit XLM escrows, and claim milestone funds.</span>
          </div>
        );
      case "youth":
        return (
          <div className="banner-notice bg-teal-soft border-teal text-teal-light mb-4">
            <CheckSquare size={20} />
            <span><strong>Youth Resident Portal:</strong> Audit milestone proofs and submit signatures to release budget escrows.</span>
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

  // Render workspace menu components
  const renderMainWorkspace = () => {
    if (loading && projects.length === 0) {
      return <LoadingSpinner size="lg" label="Synchronizing ledger state..." />;
    }

    switch (activeMenu) {
      case "transparency":
        return <TransparencyHub projects={projects} eventLogs={eventLogs} />;

      case "voters":
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
        return (
          <YouthDashboard
            voterAddress={address!}
            projects={projects}
            onExecute={executeAction}
          />
        );

      case "projects":
      case "propose":
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
        return (
          <SKWorkspace
            skAddress={address!}
            projects={projects}
            onExecute={executeAction}
          />
        );

      case "verify":
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
        return <AdminPanel adminAddress={address!} onExecute={executeAction} />;

      case "system":
      case "logs":
        return (
          <div className="system-admin-dashboard">
            {/* Participating Barangays Section */}
            <div className="panel-card mb-4">
              <h2 className="panel-title">Participating Barangay Allocations</h2>
              <p className="panel-subtitle">Propose and approve local government units participating in the platform. Only approved units are visible to residents.</p>
              
              <div className="grid-2">
                {/* Propose Form */}
                <form onSubmit={handleProposeBgy} className="panel-form" style={{ background: "rgba(0,0,0,0.15)", padding: "1.5rem", borderRadius: "10px" }}>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "var(--role-accent)" }}>Propose Barangay</h3>
                  
                  <div className="form-group">
                    <label>Barangay Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Central Barangay"
                      value={bgyName}
                      onChange={(e) => setBgyName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Municipality / City</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Manila"
                      value={bgyMuni}
                      onChange={(e) => setBgyMuni(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Province</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Metro Manila"
                      value={bgyProv}
                      onChange={(e) => setBgyProv(e.target.value)}
                      required
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary" disabled={submittingBgy}>
                    {submittingBgy ? "Submitting..." : "Propose Participating Barangay"}
                  </button>
                </form>

                {/* Proposed List */}
                <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "var(--text-primary)" }}>Registry Timeline</h3>
                  {allBarangays.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No barangays submitted in the database registry.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="ledger-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Municipality</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allBarangays.map((b) => (
                            <tr key={b.id}>
                              <td className="font-bold">{b.name}</td>
                              <td>{b.municipality}</td>
                              <td>
                                <span className={`badge ${b.status === "approved" ? "badge-success" : "badge-warning"}`}>
                                  {b.status}
                                </span>
                              </td>
                              <td>
                                {b.status === "pending" ? (
                                  <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleApproveBgy(b.id)}
                                  >
                                    Approve
                                  </button>
                                ) : (
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Active</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Smart Contract Info */}
            <div className="panel-card">
              <h2 className="panel-title">System RPC Node & Contract Details</h2>
              <p className="panel-subtitle">Manage deployed networks, check RPC node status, and review platform variables.</p>
              <div className="grid-2">
                <div className="stats-card">
                  <span className="stats-title">Contract ID</span>
                  <span className="stats-value" style={{ fontSize: "1.05rem", fontFamily: "monospace" }}>
                    CCJYQG5OTMKW3HCA73ISFLUX3ZDBKKX4JT7ZLD7ZFPS7POGZJ2C3ZDJP
                  </span>
                  <span className="stats-desc mt-2">Soroban Smart Contract Deployed on Stellar Testnet</span>
                </div>
                <div className="stats-card">
                  <span className="stats-title">Token Asset</span>
                  <span className="stats-value" style={{ fontSize: "1.05rem", fontFamily: "monospace" }}>
                    CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
                  </span>
                  <span className="stats-desc mt-2">Wrapped Native XLM Asset Address</span>
                </div>
              </div>
              <div className="table-responsive mt-4">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>RPC Parameter</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Stellar Horizon Server</td>
                      <td><code>https://horizon-testnet.stellar.org</code></td>
                      <td><span className="badge badge-success">Online</span></td>
                    </tr>
                    <tr>
                      <td>Soroban RPC Endpoint</td>
                      <td><code>https://soroban-testnet.stellar.org</code></td>
                      <td><span className="badge badge-success">Online</span></td>
                    </tr>
                    <tr>
                      <td>Deployer Balance</td>
                      <td><code>8,472.91 XLM</code></td>
                      <td><span className="badge badge-success">Stable</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`main-app-shell ${themeClass.theme}`}>
      {/* Dynamic Error Toast Banner */}
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
            {activeRole.replace("_", " ").toUpperCase()}
          </span>
        </div>

        <div className="header-actions-group">
          {/* Demo Role Switcher */}
          <div className="role-switcher-dropdown">
            <span className="switcher-label">Role Switcher:</span>
            <select
              className="form-control switcher-select"
              value={activeRole}
              onChange={(e) => handleRoleSimulate(e.target.value as RoleType)}
            >
              <option value="system_admin">System Admin</option>
              <option value="admin">Barangay Admin</option>
              <option value="sk">SK Official</option>
              <option value="youth">Verified Youth</option>
              <option value="viewer">Overaged (Viewer)</option>
            </select>
          </div>

          <NetworkBadge />
          <WalletSelector balance={xlmBalance} />
          <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
            <LogOut size={16} style={{ marginRight: "0.25rem" }} /> Logout
          </button>
        </div>
      </header>

      <div className="shell-body-layout">
        {/* Sidebar */}
        <aside className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-header-toggle">
            <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              <Menu size={20} />
            </button>
          </div>

          <nav className="sidebar-nav">
            {/* Standard Transparency Catalog is open to all */}
            <button 
              className={`sidebar-nav-item ${activeMenu === "transparency" ? "active" : ""}`}
              onClick={() => { setActiveMenu("transparency"); setMobileMenuOpen(false); }}
            >
              <Layout size={20} />
              <span className="nav-label">Transparency Feed</span>
            </button>

            {/* Role Specific Actions */}
            {activeRole === "system_admin" && (
              <>
                <button 
                  className={`sidebar-nav-item ${activeMenu === "system" ? "active" : ""}`}
                  onClick={() => { setActiveMenu("system"); setMobileMenuOpen(false); }}
                >
                  <Settings size={20} />
                  <span className="nav-label">System Console</span>
                </button>
                <button 
                  className={`sidebar-nav-item ${activeMenu === "logs" ? "active" : ""}`}
                  onClick={() => { setActiveMenu("logs"); setMobileMenuOpen(false); }}
                >
                  <BookOpen size={20} />
                  <span className="nav-label">System Logs</span>
                </button>
              </>
            )}

            {activeRole === "admin" && (
              <button 
                className={`sidebar-nav-item ${activeMenu === "verify" ? "active" : ""}`}
                onClick={() => { setActiveMenu("verify"); setMobileMenuOpen(false); }}
              >
                <UserCheck size={20} />
                <span className="nav-label">Resident Approvals</span>
              </button>
            )}

            {activeRole === "sk" && (
              <>
                <button 
                  className={`sidebar-nav-item ${activeMenu === "projects" ? "active" : ""}`}
                  onClick={() => { setActiveMenu("projects"); setMobileMenuOpen(false); }}
                >
                  <Users size={20} />
                  <span className="nav-label">My Projects</span>
                </button>
              </>
            )}

            {activeRole === "youth" && (
              <button 
                className={`sidebar-nav-item ${activeMenu === "voters" ? "active" : ""}`}
                onClick={() => { setActiveMenu("voters"); setMobileMenuOpen(false); }}
              >
                <CheckSquare size={20} />
                <span className="nav-label">Milestones Vote</span>
              </button>
            )}
          </nav>

          <div className="sidebar-footer">
            <span className="sidebar-footer-text">
              {sidebarCollapsed ? "v2.0" : "Barangay Bond v2.0"}
            </span>
          </div>
        </aside>

        {/* Backdrop for mobile menu */}
        {mobileMenuOpen && <div className="sidebar-mobile-backdrop" onClick={() => setMobileMenuOpen(false)}></div>}

        {/* Content Area */}
        <main className="shell-main-workspace">
          {renderBannerNotice()}
          {stateError && <div className="form-error-msg mb-4">{stateError}</div>}
          {renderMainWorkspace()}
        </main>
      </div>

      {/* Overlay Transaction Status Modal */}
      <TransactionLifecycleModal
        status={txStatus}
        txHash={txHash}
        error={txError}
        onClose={handleCloseTxModal}
      />
    </div>
  );
};

const LandingPage: React.FC<{ setViewState: (state: ViewState) => void }> = ({ setViewState }) => {
  const { connected, connect, address } = useWallet();

  const handleViewProjects = () => {
    setViewState("auth");
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <div className="landing-page-theme">
      {/* Landing Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <span className="landing-logo">Barangay Bond</span>
          <div className="landing-nav-actions">
            {!connected ? (
              <button className="btn btn-yellow" onClick={connect}>
                Connect Wallet
              </button>
            ) : (
              <div className="landing-wallet-connected">
                <span className="landing-wallet-badge">Freighter</span>
                <span className="landing-wallet-addr">{truncateAddress(address!)}</span>
              </div>
            )}
            <button className="btn btn-navy" onClick={() => setViewState("auth")}>
              Access Portal
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-hero-container">
          <span className="landing-badge">🏆 FWDP Grind Sessions 2026</span>
          <h1 className="landing-hero-title">
            Securing Local Budgets.<br />Empowering Barangay Youth.
          </h1>
          <p className="landing-hero-subtitle">
            A milestone-based funding platform built on Stellar Soroban for Sangguniang Kabataan (SK) councils in the Philippines. Lock budgets in secure escrows and let verified youth residents approve fund releases.
          </p>
          <div className="landing-hero-ctas">
            <button className="btn btn-navy btn-lg" onClick={handleViewProjects}>
              View Active Projects <ArrowRight size={18} style={{ marginLeft: "0.5rem" }} />
            </button>
            <button className="btn btn-outline-navy btn-lg" onClick={() => setViewState("auth")}>
              SK Official Login
            </button>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="landing-section bg-white-soft">
        <div className="landing-section-container">
          <h2 className="landing-section-title">Milestone Escrow in 3 Steps</h2>
          <p className="landing-section-subtitle">
            How on-chain governance secures funding allocations for community improvements.
          </p>

          <div className="grid-3 mt-4">
            <div className="landing-step-card">
              <div className="landing-step-icon bg-amber-soft text-amber">
                <Lock size={28} />
              </div>
              <h3>1. Lock & Mobilize</h3>
              <p>SK Official deploys the project escrow, locking 100% of the budget. The contract automatically releases a 50% mobilization fund to launch the work.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-icon bg-blue-soft text-blue">
                <Camera size={28} />
              </div>
              <h3>2. Upload Proof</h3>
              <p>SK Official uploads verifiable proof of Milestone 1 completion (photos, receipts, reports) directly to the decentralized public timeline.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-icon bg-green-soft text-green">
                <CheckSquare size={28} />
              </div>
              <h3>3. Youth Payout Vote</h3>
              <p>Verified youth residents audit the deliverables and sign votes. Reaching the consensus threshold triggers the contract to auto-release the remaining 50%.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Roles Matrix Section */}
      <section className="landing-section">
        <div className="landing-section-container">
          <h2 className="landing-section-title">Platform Roles Matrix</h2>
          <p className="landing-section-subtitle">
            Who uses Barangay Bond and how they coordinate within local governance.
          </p>

          <div className="grid-3">
            <div className="landing-step-card">
              <div className="landing-step-icon bg-blue-soft text-blue">
                <UserCheck size={28} />
              </div>
              <h3>Barangay Admin</h3>
              <p>The local gatekeeper. Verifies resident registration profiles, checks birthdates, and authorizes public wallet addresses on-chain.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-icon bg-amber-soft text-amber">
                <Users size={28} />
              </div>
              <h3>SK Official</h3>
              <p>The project builder. Proposes community developments (e.g. WiFi Hubs, libraries), locks native budgets, and uploads work audits.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-icon bg-green-soft text-green">
                <CheckSquare size={28} />
              </div>
              <h3>Youth Resident</h3>
              <p>The auditor. Verified residents aged 15-30 who inspect deliverables on the transparency catalog and vote on-chain using Stellar wallets.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-section bg-white-soft">
        <div className="landing-section-container">
          <h2 className="landing-section-title">Built for Modern Civic Trust</h2>
          <p className="landing-section-subtitle">
            Combining robust Web2 profile protections with public blockchain auditability.
          </p>

          <div className="grid-2 mt-4">
            <div className="landing-feature-item">
              <div className="feature-item-icon">
                <ShieldCheck size={24} className="text-amber" />
              </div>
              <div>
                <h3>Zero Fake Accounts</h3>
                <p>Strict age checks and database residency controls guarantee only local youth can vote on project allocations.</p>
              </div>
            </div>
            <div className="landing-feature-item">
              <div className="feature-item-icon">
                <Cpu size={24} className="text-amber" />
              </div>
              <div>
                <h3>Automated Tranches</h3>
                <p>No manual checks or administrative delays. Escrows release funds the moment approvals hit the threshold.</p>
              </div>
            </div>
            <div className="landing-feature-item">
              <div className="feature-item-icon">
                <Database size={24} className="text-amber" />
              </div>
              <div>
                <h3>On-Chain Escrows</h3>
                <p>Budgets are secured in native XLM contract tokens, isolating funds away from third-party custody risks.</p>
              </div>
            </div>
            <div className="landing-feature-item">
              <div className="feature-item-icon">
                <RefreshCw size={24} className="text-amber" />
              </div>
              <div>
                <h3>Real-Time Transparency</h3>
                <p>All operations publish on-chain events that feed directly into the community catalog audit feed.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>Built by Renz Buday (Solo Builder) | Powered by Stellar Soroban</p>
      </footer>
    </div>
  );
};

const AuthPage: React.FC<{ setViewState: (state: ViewState) => void }> = ({ setViewState }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [desiredRole, setDesiredRole] = useState<"youth" | "sk" | "admin">("youth");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Dynamic Barangay list state
  const [approvedBarangays, setApprovedBarangays] = useState<any[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [selectedBarangayId, setSelectedBarangayId] = useState("");

  const { signIn, signUp, getApprovedBarangays } = useAuth();

  // Load approved barangays asynchronously on registration form display
  useEffect(() => {
    if (!isLogin && desiredRole !== "admin") {
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
        if (desiredRole === "admin") {
          await signUp(email, password, name, birthdate, "admin_global", "Global Admin", desiredRole);
        } else {
          const selectedBgy = approvedBarangays.find((b) => b.id === selectedBarangayId);
          if (!selectedBgy) {
            throw new Error("No approved barangay is selected. Please select one to proceed.");
          }
          await signUp(email, password, name, birthdate, selectedBgy.id, selectedBgy.name, desiredRole);
        }
      }
      setViewState("dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const isRegistrationDisabled = !isLogin && desiredRole !== "admin" && approvedBarangays.length === 0 && !loadingBarangays;

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h2 className="auth-title">{isLogin ? "Sign In to Portal" : "Register Resident Profile"}</h2>
        <p className="auth-subtitle">
          {isLogin ? "Access your transparency dashboard" : "Submit credentials to request verification role"}
        </p>

        {error && <div className="form-error-msg mb-4">{error}</div>}

        <form onSubmit={handleAuth} className="panel-form">
          {!isLogin && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Birthdate (15-30 years check)</label>
                <input
                  type="date"
                  className="form-control"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Desired Portal Role</label>
                <select
                  className="form-control"
                  value={desiredRole}
                  onChange={(e) => setDesiredRole(e.target.value as any)}
                >
                  <option value="youth">Youth Resident (Voter)</option>
                  <option value="sk">SK Official (Creator)</option>
                  <option value="admin">Barangay Admin (Platform Admin)</option>
                </select>
              </div>

              {desiredRole !== "admin" && (
                <div className="form-group">
                  <label>Select Participating Barangay</label>
                  {loadingBarangays ? (
                    <div style={{ padding: "0.5rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      ⏳ Fetching approved barangays...
                    </div>
                  ) : approvedBarangays.length === 0 ? (
                    <div className="form-error-msg" style={{ fontSize: "0.85rem", padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px" }}>
                      ⚠️ There are currently no approved barangays participating in Barangay Bond. Please contact your local government or try again later.
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
            </>
          )}

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

          <button type="submit" className="btn btn-primary w-100" disabled={loading || isRegistrationDisabled}>
            {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <div className="auth-toggle-row">
          <button className="btn-text-link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Need a new profile? Register here" : "Already have an account? Sign in"}
          </button>
        </div>

        {isLogin && (
          <div style={{ marginTop: "1.5rem", fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center" }}>
            💡 Tip: You can register any email as a <strong>Barangay Admin</strong> to instantly access administrative approval tools.
          </div>
        )}

        <button className="btn-back-landing" onClick={() => setViewState("landing")}>
          ← Back to Landing Page
        </button>
      </div>
    </div>
  );
};

const AppController: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>("landing");
  const { loading, user } = useAuth();

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

  switch (viewState) {
    case "landing":
      return <LandingPage setViewState={setViewState} />;
    case "auth":
      return <AuthPage setViewState={setViewState} />;
    case "dashboard":
      if (!user) {
        setViewState("landing");
        return null;
      }
      return <MainLayout setViewState={setViewState} />;
    default:
      return null;
  }
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <WalletProvider>
        <AppController />
      </WalletProvider>
    </AuthProvider>
  );
};

export default App;
