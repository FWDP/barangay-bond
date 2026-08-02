import React, { useState } from "react";
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
import { Lock, Camera, CheckSquare, ShieldCheck, Cpu, Database, RefreshCw, ArrowRight } from "lucide-react";

type ViewState = "landing" | "auth" | "dashboard";
type Tab = "transparency" | "youth" | "sk" | "admin";

const MainLayout: React.FC<{ setViewState: (state: ViewState) => void }> = ({ setViewState }) => {
  const [activeTab, setActiveTab] = useState<Tab>("transparency");
  const { projects, eventLogs, loading, xlmBalance, error: stateError } = useContractState();
  const { address, connected, connect } = useWallet();
  const { profile, signOut } = useAuth();

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
        if (err) setTxError(err);
      });
    } catch (err: any) {
      console.error("Action execution caught error:", err);
    }
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

  // Determine role access flags
  const isAdmin = profile?.role === "admin";
  const isSK = profile?.role === "sk";
  const isYouth = profile?.role === "youth";
  const isViewer = profile?.role === "viewer";

  const renderActiveTab = () => {
    if (loading && projects.length === 0) {
      return <LoadingSpinner size="lg" label="Synchronizing ledger state..." />;
    }

    switch (activeTab) {
      case "transparency":
        return <TransparencyHub projects={projects} eventLogs={eventLogs} />;

      case "youth":
        if (!connected) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔑</div>
              <h3>Stellar Wallet Required</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                This dashboard requires on-chain interactions. Please connect Freighter, xBull, or Albedo.
              </p>
              <button className="btn btn-primary" onClick={connect}>
                Connect Stellar Wallet
              </button>
            </div>
          );
        }
        if (!isYouth) {
          return (
            <div className="empty-panel-state">
              <h3>Voter Access Denied</h3>
              <p className="mt-2 text-secondary" style={{ maxWidth: "480px", margin: "1rem auto" }}>
                Your wallet is linked to a <strong>{profile?.role.toUpperCase()}</strong> profile. 
                Voter privileges require a verified <strong>Youth Resident</strong> status. Contact the Barangay Admin.
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

      case "sk":
        if (!connected) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔑</div>
              <h3>Stellar Wallet Required</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                This dashboard requires on-chain interactions. Please connect Freighter, xBull, or Albedo.
              </p>
              <button className="btn btn-primary" onClick={connect}>
                Connect Stellar Wallet
              </button>
            </div>
          );
        }
        if (!isSK) {
          return (
            <div className="empty-panel-state">
              <h3>SK Official Access Denied</h3>
              <p className="mt-2 text-secondary" style={{ maxWidth: "480px", margin: "1rem auto" }}>
                Your wallet is linked to a <strong>{profile?.role.toUpperCase()}</strong> profile. 
                Budget releases require a verified <strong>SK Official</strong> status. Contact the Barangay Admin.
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
        if (!connected) {
          return (
            <div className="empty-panel-state" style={{ maxWidth: "480px", margin: "3rem auto" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔑</div>
              <h3>Stellar Wallet Required</h3>
              <p className="mt-2 text-secondary" style={{ marginBottom: "1.5rem" }}>
                This dashboard requires on-chain interactions. Please connect Freighter, xBull, or Albedo.
              </p>
              <button className="btn btn-primary" onClick={connect}>
                Connect Stellar Wallet
              </button>
            </div>
          );
        }
        if (!isAdmin) {
          return (
            <div className="empty-panel-state">
              <h3>Admin Console Access Denied</h3>
              <p className="mt-2 text-secondary">
                Only the Barangay Admin profile can view this console.
              </p>
            </div>
          );
        }
        return <AdminPanel adminAddress={address!} onExecute={executeAction} />;

      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <h1 className="brand-title">Barangay Bond</h1>
          <span className="brand-tagline">
            Profile: <strong>{profile?.name}</strong> ({profile?.role.toUpperCase()})
          </span>
        </div>
        <div className="header-meta">
          <NetworkBadge />
          <WalletSelector balance={xlmBalance} />
          <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Tabs navigation */}
      <nav className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === "transparency" ? "active" : ""}`}
          onClick={() => setActiveTab("transparency")}
        >
          Transparency Catalog
        </button>
        
        {isYouth && (
          <button
            className={`tab-btn ${activeTab === "youth" ? "active" : ""}`}
            onClick={() => setActiveTab("youth")}
          >
            Youth Resident Portal
          </button>
        )}
        
        {isSK && (
          <button
            className={`tab-btn ${activeTab === "sk" ? "active" : ""}`}
            onClick={() => setActiveTab("sk")}
          >
            SK Official Workspace
          </button>
        )}
        
        {isAdmin && (
          <button
            className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
            onClick={() => setActiveTab("admin")}
          >
            Admin Console
          </button>
        )}

        {isViewer && (
          <span className="tab-restriction-msg" style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            ⚠️ Connect and link wallet to request admin verification
          </span>
        )}
      </nav>

      {stateError && <div className="form-error-msg mb-4">{stateError}</div>}

      {/* Content body */}
      <main className="app-main">{renderActiveTab()}</main>

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
            Empowering the Youth.<br />Securing the Budget.
          </h1>
          <p className="landing-hero-subtitle">
            A milestone-based funding platform that gives the youth the power to verify local projects step-by-step using smart escrows.
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
          <h2 className="landing-section-title">Transparent Escrow in 3 Steps</h2>
          <p className="landing-section-subtitle">
            How on-chain governance secures funding allocations for community improvements.
          </p>

          <div className="grid-3 mt-4">
            <div className="landing-step-card">
              <div className="landing-step-icon bg-amber-soft text-amber">
                <Lock size={28} />
              </div>
              <h3>1. Lock the Budget</h3>
              <p>SK Officials propose projects. Funds are secured in a Stellar smart contract.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-icon bg-blue-soft text-blue">
                <Camera size={28} />
              </div>
              <h3>2. Submit Proof</h3>
              <p>Contractors finish Phase 1 and upload photos of the completed milestone.</p>
            </div>
            <div className="landing-step-card">
              <div className="landing-step-icon bg-green-soft text-green">
                <CheckSquare size={28} />
              </div>
              <h3>3. Youth Verification</h3>
              <p>Verified youth residents vote. If approved, Phase 2 funds are automatically released.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-section">
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
  const [barangay, setBarangay] = useState("Central Barangay");
  const [desiredRole, setDesiredRole] = useState<"youth" | "sk" | "admin">("youth");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, name, birthdate, barangay, desiredRole);
      }
      setViewState("dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

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
                <label>Barangay</label>
                <select
                  className="form-control"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                >
                  <option value="Central Barangay">Central Barangay</option>
                  <option value="West Barangay">West Barangay</option>
                  <option value="East Barangay">East Barangay</option>
                </select>
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

          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
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
