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

type ViewState = "landing" | "auth" | "dashboard";
type Tab = "transparency" | "youth" | "sk" | "admin";

const MainLayout: React.FC<{ setViewState: (state: ViewState) => void }> = ({ setViewState }) => {
  const [activeTab, setActiveTab] = useState<Tab>("transparency");
  const { projects, eventLogs, loading, xlmBalance, error: stateError } = useContractState();
  const { address, connected } = useWallet();
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
            <div className="empty-panel-state">
              <p>Stellar wallet connection required. Click "Connect Stellar Wallet" in the header.</p>
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
            <div className="empty-panel-state">
              <p>Stellar wallet connection required. Click "Connect Stellar Wallet" in the header.</p>
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
            <div className="empty-panel-state">
              <p>Stellar wallet connection required. Click "Connect Stellar Wallet" in the header.</p>
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
  return (
    <div className="landing-layout">
      <div className="landing-hero">
        <h1 className="hero-title">Barangay Bond</h1>
        <p className="hero-subtitle">
          Empowering youth governance and transparent project allocations in local communities. 
          Powered by Firebase Identity and Stellar Soroban Escrow contracts.
        </p>
        <button className="btn btn-primary btn-lg" onClick={() => setViewState("auth")}>
          Enter Governance Portal
        </button>
      </div>

      <div className="landing-features grid-3 mt-4">
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h3>Firebase Identity</h3>
          <p>Secure authentication, Birthdate validation, residency verifications, and account protection.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⛓️</div>
          <h3>Soroban Escrows</h3>
          <p>Native XLM budgets are locked in decentralized contracts and released via milestone reviews.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🗳️</div>
          <h3>Youth Governance</h3>
          <p>Verified youth residents use secure wallets to audit, approve, or reject community projects.</p>
        </div>
      </div>
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
        // Validate birthdate for youth residents (e.g. usually ages 15-30)
        const birthYear = new Date(birthdate).getFullYear();
        const currentYear = new Date().getFullYear();
        const age = currentYear - birthYear;
        if (age < 15 || age > 30) {
          throw new Error("Youth resident registration requires age between 15 and 30 years.");
        }
        await signUp(email, password, name, birthdate, barangay, "youth");
      }
      setViewState("dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const loadQuickAdmin = () => {
    setEmail("admin@barangay.gov");
    setPassword("admin12345");
    setIsLogin(true);
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
          <div className="quick-login-section">
            <div className="divider"><span>OR</span></div>
            <button className="btn btn-outline-info w-100" onClick={loadQuickAdmin}>
              Quick Load Barangay Admin Credentials
            </button>
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
