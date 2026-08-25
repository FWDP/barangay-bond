import React, { useState } from "react";
import { createPortal } from "react-dom";
import type { TransactionStatus } from "../types";
import { LoadingSpinner } from "./LoadingSpinner";
import { CheckCircle2, XCircle, AlertTriangle, Copy, Check, ShieldCheck, ArrowUpRight, FileText } from "lucide-react";
import { generatePaymentReceiptPdf } from "../utils/receipt";

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
          description: "Simulating on-chain operations and computing cryptographic footprints on Stellar Testnet...",
          badgeColor: "rgba(0, 125, 254, 0.12)",
          icon: <LoadingSpinner size="raw" hideLabels={true} />,
          step: 1,
        };
      case "Submitted":
        return {
          title: "Broadcasting to Stellar RPC",
          description: "Awaiting ledger consensus and cryptographic seal on Stellar Soroban...",
          badgeColor: "rgba(0, 125, 254, 0.12)",
          icon: <LoadingSpinner size="raw" hideLabels={true} />,
          step: 2,
        };
      case "Confirmed":
        return {
          title: "Transaction Finalized!",
          description: "The escrow action was cryptographically validated and confirmed on the Stellar Testnet ledger.",
          badgeColor: "var(--accent-green-soft)",
          icon: <CheckCircle2 size={38} style={{ color: "var(--accent-green)" }} />,
          step: 3,
        };
      case "Failed":
        return {
          title: "Transaction Failed",
          description: "The transaction was executed but rejected by the Stellar Soroban virtual machine.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <XCircle size={38} style={{ color: "var(--accent-danger)" }} />,
          step: 3,
        };
      case "Rejected":
      case "WalletCancelled":
        return {
          title: "Signing Cancelled",
          description: "You rejected or cancelled the transaction signature inside your wallet extension.",
          badgeColor: "rgba(245, 158, 11, 0.15)",
          icon: <AlertTriangle size={38} style={{ color: "#f59e0b" }} />,
          step: 1,
        };
      case "Expired":
        return {
          title: "Transaction Expired",
          description: "The transaction timed out waiting for consensus confirmation. Please retry.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <AlertTriangle size={38} style={{ color: "var(--accent-danger)" }} />,
          step: 3,
        };
      case "SimulationError":
        return {
          title: "Simulation Failure",
          description: "Contract preconditions or role qualifications were not satisfied during RPC simulation.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <AlertTriangle size={38} style={{ color: "var(--accent-danger)" }} />,
          step: 1,
        };
      case "NetworkError":
        return {
          title: "RPC Server Error",
          description: "Unable to reach the Stellar Soroban RPC node. Check your network connection.",
          badgeColor: "var(--accent-danger-soft)",
          icon: <AlertTriangle size={38} style={{ color: "var(--accent-danger)" }} />,
          step: 1,
        };
      default:
        return {
          title: "Processing On-Chain",
          description: "Submitting operation to Stellar Soroban...",
          badgeColor: "rgba(0, 125, 254, 0.12)",
          icon: <LoadingSpinner size="raw" hideLabels={true} />,
          step: 1,
        };
    }
  };

  const details = renderStatusDetails();
  const isFinished = ["Confirmed", "Failed", "Rejected", "WalletCancelled", "Expired", "SimulationError", "NetworkError"].includes(status);
  const isSuccess = status === "Confirmed";

  return createPortal(
    <div className="modal-overlay" onClick={isFinished ? onClose : undefined} style={{ backdropFilter: "blur(8px)" }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px", padding: "2.2rem 1.8rem", borderRadius: "24px" }}>
        <div className="bottom-sheet-handle" />

        {/* Top Status Icon & Halo */}
        <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
          <div
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "50%",
              background: details.badgeColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem auto",
              position: "relative",
              boxShadow: isSuccess
                ? "0 0 30px var(--accent-green-glow)"
                : !isFinished
                ? "0 0 30px rgba(0, 125, 254, 0.2)"
                : "none",
              border: isSuccess
                ? "2px solid var(--accent-green)"
                : !isFinished
                ? "2px solid rgba(0, 125, 254, 0.35)"
                : "2px solid var(--border-subtle)",
            }}
          >
            {details.icon}
          </div>

          <span
            className="badge"
            style={{
              background: isSuccess ? "var(--accent-green-soft)" : "rgba(0, 125, 254, 0.12)",
              color: isSuccess ? "var(--accent-green)" : "var(--role-accent)",
              border: `1px solid ${isSuccess ? "var(--accent-green)" : "var(--role-accent-border)"}`,
              fontSize: "0.7rem",
              fontWeight: 800,
              letterSpacing: "0.5px",
              marginBottom: "0.6rem",
              textTransform: "uppercase",
            }}
          >
            {isSuccess ? "✓ Ledger Confirmed" : !isFinished ? "⚡ Stellar Soroban Pipeline" : "⚠️ Transaction Notice"}
          </span>

          <h3 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", margin: "0 0 0.35rem 0", letterSpacing: "-0.02em" }}>
            {details.title}
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5, margin: "0 auto", maxWidth: "380px" }}>
            {details.description}
          </p>

          {/* Multi-step progress bar for in-flight transactions */}
          {!isFinished && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem", padding: "0.65rem 0.9rem", background: "var(--bg-elevated)", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.74rem", fontWeight: 700, color: details.step >= 1 ? "var(--role-accent)" : "var(--text-muted)" }}>
                <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: details.step >= 1 ? "var(--role-accent)" : "var(--bg-card)", color: details.step >= 1 ? "#fff" : "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem" }}>1</span>
                <span>Simulate</span>
              </div>
              <div style={{ width: "18px", height: "2px", background: details.step >= 2 ? "var(--role-accent)" : "var(--border-subtle)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.74rem", fontWeight: 700, color: details.step >= 2 ? "var(--role-accent)" : "var(--text-muted)" }}>
                <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: details.step >= 2 ? "var(--role-accent)" : "var(--bg-card)", color: details.step >= 2 ? "#fff" : "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem" }}>2</span>
                <span>Sign & Seal</span>
              </div>
              <div style={{ width: "18px", height: "2px", background: details.step >= 3 ? "var(--accent-green)" : "var(--border-subtle)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.74rem", fontWeight: 700, color: details.step >= 3 ? "var(--accent-green)" : "var(--text-muted)" }}>
                <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: details.step >= 3 ? "var(--accent-green)" : "var(--bg-card)", color: details.step >= 3 ? "#000" : "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem" }}>3</span>
                <span>Finalize</span>
              </div>
            </div>
          )}

          {!isFinished && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", marginTop: "0.75rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
              <ShieldCheck size={14} style={{ color: "var(--accent-green)" }} />
              <span>Please keep this window open while processing...</span>
            </div>
          )}
        </div>

        {/* Transaction Receipt Card */}
        {txHash && (
          <div className="web3-receipt-card" style={{ marginBottom: "1.2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                On-Chain Hash Receipt
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm tap-scale"
                onClick={copyToClipboard}
                style={{ height: "28px", fontSize: "0.72rem", padding: "0.15rem 0.55rem", borderRadius: "8px" }}
              >
                {copied ? <><Check size={12} style={{ color: "var(--accent-green)" }} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>

            <div style={{ background: "var(--bg-input)", padding: "0.5rem 0.75rem", borderRadius: "10px", border: "1px solid var(--border-subtle)", wordBreak: "break-all", marginBottom: "0.75rem" }}>
              <code style={{ fontSize: "0.76rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {txHash}
              </code>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-chip tap-scale"
                style={{ flex: 1, justifyContent: "center", padding: "0.45rem 0.65rem", fontSize: "0.76rem" }}
              >
                <span>View Explorer</span>
                <ArrowUpRight size={13} />
              </a>

              <button
                type="button"
                className="btn btn-primary btn-sm tap-scale"
                onClick={async () => {
                  setIsGeneratingPdf(true);
                  try {
                    await generatePaymentReceiptPdf({
                      txHash,
                      senderAddress: "On-Chain Participant",
                      recipientAddress: "Barangay Bond Escrow Contract",
                      amountXlm: "0.00",
                      timestamp: new Date().toISOString(),
                    });
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }}
                disabled={isGeneratingPdf}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", fontSize: "0.76rem", borderRadius: "10px", fontWeight: 700 }}
              >
                <FileText size={13} />
                <span>{isGeneratingPdf ? "Generating..." : "PDF Receipt"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Details */}
        {error && (
          <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "14px", padding: "0.85rem", color: "#f87171", fontSize: "0.82rem", marginBottom: "1.2rem", maxHeight: "120px", overflowY: "auto" }}>
            <strong style={{ display: "block", marginBottom: "0.2rem" }}>Diagnosis:</strong>
            {error}
          </div>
        )}

        {/* Action Button */}
        <div>
          {isFinished ? (
            <button className="btn btn-primary w-100 tap-scale" onClick={onClose} style={{ height: "48px", borderRadius: "14px", fontSize: "0.95rem", fontWeight: 800 }}>
              {isSuccess ? "Complete & Return" : "Dismiss"}
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.8rem", padding: "0.5rem" }}>
              <ShieldCheck size={16} style={{ color: "var(--role-accent)" }} />
              <span>Please keep this window open while processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TransactionLifecycleModal;
