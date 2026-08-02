import React, { useState } from "react";
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

type Tab = "transparency" | "youth" | "sk" | "admin";

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("transparency");
  const { projects, eventLogs, loading, xlmBalance, error: stateError } = useContractState();
  const { address, roles, connected } = useWallet();

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
              <p>Please connect your wallet to access the Youth resident portal.</p>
            </div>
          );
        }
        if (!roles.isYouth) {
          return (
            <div className="empty-panel-state">
              <h3>Voter Access Denied</h3>
              <p className="mt-2 text-secondary">
                Your address <code>{address}</code> is not verified as a youth resident. 
                Please contact the Barangay Admin to grant verification.
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
              <p>Please connect your wallet to access the SK workspace.</p>
            </div>
          );
        }
        if (!roles.isSKOfficial) {
          return (
            <div className="empty-panel-state">
              <h3>SK Official Access Denied</h3>
              <p className="mt-2 text-secondary">
                Your address <code>{address}</code> is not verified as an SK official. 
                Please contact the Barangay Admin to grant verification.
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
              <p>Please connect your wallet to access the Admin console.</p>
            </div>
          );
        }
        if (!roles.isAdmin) {
          return (
            <div className="empty-panel-state">
              <h3>Admin Console Access Denied</h3>
              <p className="mt-2 text-secondary">
                Only the Barangay Admin account can access this panel.
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
          <span className="brand-tagline">Decentralized Governance & Transparent Escrow</span>
        </div>
        <div className="header-meta">
          <NetworkBadge />
          <WalletSelector balance={xlmBalance} />
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
        <button
          className={`tab-btn ${activeTab === "youth" ? "active" : ""}`}
          onClick={() => setActiveTab("youth")}
        >
          Youth Resident Portal
        </button>
        <button
          className={`tab-btn ${activeTab === "sk" ? "active" : ""}`}
          onClick={() => setActiveTab("sk")}
        >
          SK Official Workspace
        </button>
        <button
          className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
          onClick={() => setActiveTab("admin")}
        >
          Admin Console
        </button>
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

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
};

export default App;
