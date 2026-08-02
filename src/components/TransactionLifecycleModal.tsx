import React, { useState } from "react";
import type { TransactionStatus } from "../types";
import { LoadingSpinner } from "./LoadingSpinner";

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
          title: "Preparing Transaction",
          description: "Simulating operations, allocating footprints, and fetching fees on Stellar Testnet...",
          className: "status-pending",
          icon: <LoadingSpinner size="md" />,
        };
      case "Submitted":
        return {
          title: "Submitting to Stellar RPC",
          description: "Waiting for ledger validation and consensus confirmation on-chain...",
          className: "status-submitted",
          icon: <LoadingSpinner size="md" />,
        };
      case "Confirmed":
        return {
          title: "Transaction Confirmed!",
          description: "The action was successfully recorded on the Stellar ledger.",
          className: "status-confirmed",
          icon: <span className="status-large-icon success-icon">✓</span>,
        };
      case "Failed":
        return {
          title: "Transaction Failed",
          description: "The transaction was executed but failed on-chain or submission was rejected.",
          className: "status-failed",
          icon: <span className="status-large-icon error-icon">✗</span>,
        };
      case "Rejected":
      case "WalletCancelled":
        return {
          title: "Signature Rejected",
          description: "You cancelled the signing request in your wallet extension.",
          className: "status-cancelled",
          icon: <span className="status-large-icon warning-icon">!</span>,
        };
      case "Expired":
        return {
          title: "Transaction Expired",
          description: "The network was unable to confirm the transaction in the required timeframe. Please try again.",
          className: "status-expired",
          icon: <span className="status-large-icon error-icon">⌛</span>,
        };
      case "SimulationError":
        return {
          title: "Simulation Failure",
          description: "The transaction simulation failed. This usually means the contract requirements were not met (e.g. unauthorized role).",
          className: "status-sim-error",
          icon: <span className="status-large-icon error-icon">⚠</span>,
        };
      case "NetworkError":
        return {
          title: "Network RPC Error",
          description: "Could not communicate with the Stellar Testnet RPC server or friendbot. Please check your connection.",
          className: "status-network-error",
          icon: <span className="status-large-icon error-icon">🔌</span>,
        };
      default:
        return {
          title: "Processing",
          description: "Please wait...",
          className: "status-processing",
          icon: <LoadingSpinner size="md" />,
        };
    }
  };

  const details = renderStatusDetails();
  const isFinished = ["Confirmed", "Failed", "Rejected", "WalletCancelled", "Expired", "SimulationError", "NetworkError"].includes(status);

  return (
    <div className="modal-backdrop">
      <div className={`modal-card ${details.className}`}>
        <div className="modal-header">
          <h3 className="modal-title">{details.title}</h3>
          {isFinished && (
            <button className="modal-close-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>
        <div className="modal-body">
          <div className="modal-icon-wrapper">{details.icon}</div>
          <p className="modal-description">{details.description}</p>

          {txHash && (
            <div className="modal-tx-details">
              <span className="details-label">Tx Hash:</span>
              <div className="tx-hash-row">
                <code className="tx-hash-code">{`${txHash.slice(0, 10)}...${txHash.slice(-10)}`}</code>
                <button className="btn btn-sm btn-outline-secondary" onClick={copyToClipboard}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
              >
                View on Stellar.Expert ↗
              </a>
            </div>
          )}

          {error && (
            <div className="modal-error-diagnostics">
              <span className="details-label">Diagnosis:</span>
              <pre className="diagnostics-code">{error}</pre>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {isFinished ? (
            <button className="btn btn-primary w-100" onClick={onClose}>
              Dismiss
            </button>
          ) : (
            <p className="modal-wait-text">Please sign and do not close your browser...</p>
          )}
        </div>
      </div>
    </div>
  );
};
