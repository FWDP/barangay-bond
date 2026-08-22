import React, { useState } from "react";
import type { TransactionStatus } from "../types";
import { LoadingSpinner } from "./LoadingSpinner";
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, Copy, Check } from "lucide-react";

interface TransactionLifecycleModalProps {
  status: TransactionStatus;
  txHash?: string;
  error?: string;
  onClose: () => void;
}

export const TransactionLifecycleModal: React.FC<TransactionLifecycleModalProps> = ({
  status,
  txHash,
  error,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (status === "Idle") return null;

  const copyToClipboard = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderStatusDetails = () => {
    switch (status) {
      case "Pending":
        return {
          title: "Preparing Soroban Transaction",
          description: "Simulating operations and fetching cryptographic footprints on Stellar Testnet...",
          badgeColor: "rgba(0, 125, 254, 0.15)",
          icon: <LoadingSpinner size="md" />,
        };
      case "Submitted":
        return {
          title: "Submitting to Stellar RPC",
          description: "Waiting for ledger validation and consensus confirmation on-chain...",
          badgeColor: "rgba(0, 125, 254, 0.15)",
          icon: <LoadingSpinner size="md" />,
        };
      case "Confirmed":
        return {
          title: "Transaction Successful!",
          description: "The escrow action was cryptographically confirmed and sealed on Stellar Soroban.",
          badgeColor: "var(--accent-green-soft)",
          icon: <CheckCircle2 size={40} style={{ color: "var(--accent-green)" }} />,
        };
      case "Failed":
        return {
          title: "Transaction Failed",
          description: "The transaction was executed but failed on-chain or submission was rejected.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <XCircle size={40} style={{ color: "var(--accent-danger)" }} />,
        };
      case "Rejected":
      case "WalletCancelled":
        return {
          title: "Signature Cancelled",
          description: "You cancelled the signing request in your wallet extension.",
          badgeColor: "rgba(245, 158, 11, 0.15)",
          icon: <AlertTriangle size={40} style={{ color: "#f59e0b" }} />,
        };
      case "Expired":
        return {
          title: "Transaction Expired",
          description: "The network was unable to confirm the transaction in the required timeframe. Please try again.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <AlertTriangle size={40} style={{ color: "var(--accent-danger)" }} />,
        };
      case "SimulationError":
        return {
          title: "Simulation Failure",
          description: "The transaction simulation failed. Check contract conditions or role permissions.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <AlertTriangle size={40} style={{ color: "var(--accent-danger)" }} />,
        };
      case "NetworkError":
        return {
          title: "Network RPC Error",
          description: "Could not communicate with the Stellar Testnet RPC server. Please check your connection.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <AlertTriangle size={40} style={{ color: "var(--accent-danger)" }} />,
        };
      default:
        return {
          title: "Processing",
          description: "Please wait...",
          badgeColor: "rgba(0, 125, 254, 0.15)",
          icon: <LoadingSpinner size="md" />,
        };
    }
  };

  const details = renderStatusDetails();
  const isFinished = ["Confirmed", "Failed", "Rejected", "WalletCancelled", "Expired", "SimulationError", "NetworkError"].includes(status);

  return (
    <div className="modal-overlay" onClick={isFinished ? onClose : undefined}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
        <div className="bottom-sheet-handle" />

        <div style={{ textAlign: "center", marginBottom: "1.3rem" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: details.badgeColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 0.9rem auto",
            }}
          >
            {details.icon}
          </div>

          <h3 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-primary)", margin: "0 0 0.3rem 0" }}>
            {details.title}
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.45, margin: 0 }}>
            {details.description}
          </p>
        </div>

        {txHash && (
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "16px", padding: "0.95rem 1.1rem", marginBottom: "1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Transaction Receipt</span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={copyToClipboard}
                style={{ height: "28px", fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}
              >
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <code style={{ fontSize: "0.76rem", color: "var(--accent-blue)", wordBreak: "break-all" }}>
              {txHash}
            </code>
            <div style={{ marginTop: "0.4rem" }}>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.78rem", color: "var(--accent-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontWeight: 700 }}
              >
                View on Stellar.Expert <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "var(--accent-danger-soft)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "14px", padding: "0.8rem", color: "#f87171", fontSize: "0.8rem", marginBottom: "1.1rem", maxHeight: "120px", overflowY: "auto" }}>
            <strong>Diagnosis:</strong> {error}
          </div>
        )}

        <div>
          {isFinished ? (
            <button className="btn btn-primary w-100" onClick={onClose} style={{ height: "46px" }}>
              Dismiss Receipt
            </button>
          ) : (
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", margin: 0 }}>
              Please do not close this window while transaction is submitting...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionLifecycleModal;
