import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { walletTransactionService, type WalletTransaction } from "../services/walletTransaction.service";
import { generateOfficialReceiptPdf } from "../utils/receiptPdfGenerator";
import { useAuth } from "../contexts/AuthContext";
import {
  X,
  RefreshCw,
  Download,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Receipt,
  FileCheck2,
  Wallet
} from "lucide-react";

interface WalletTransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

export const WalletTransactionHistoryModal: React.FC<WalletTransactionHistoryModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
}) => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "in_app" | "external" | "inbound" | "outbound">("all");

  const fetchHistory = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const data = await walletTransactionService.getWalletTransactions(
        walletAddress,
        profile?.walletAddress || undefined
      );
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, profile?.walletAddress]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  if (!isOpen) return null;

  const filteredList = transactions.filter((tx) => {
    const matchesSearch =
      tx.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.title.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === "all") return true;
    if (filterType === "in_app") return tx.paymentMethod === "in_app";
    if (filterType === "external") return tx.paymentMethod === "external";
    if (filterType === "inbound") return tx.direction === "inbound";
    if (filterType === "outbound") return tx.direction === "outbound";
    return true;
  });

  const handleDownloadReceipt = (tx: WalletTransaction) => {
    generateOfficialReceiptPdf(tx, {
      userName: profile?.name || "Verified Citizen",
      barangayName: profile?.barangayName || profile?.barangayId || "Barangay Bond Escrow",
      role: profile?.role || "Resident",
    });
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          width: "100%",
          maxWidth: "860px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "20px",
          overflow: "hidden",
          padding: 0,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "var(--role-accent-soft)",
                color: "var(--role-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Receipt size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Wallet Activity & Official Receipts
              </h3>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)} • Stellar Testnet
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              className="btn btn-sm btn-outline tap-scale"
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh ledger history"
              style={{ height: "36px" }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="btn btn-sm btn-outline tap-scale"
              style={{ width: "36px", height: "36px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTROLS BAR (SEARCH & FILTER TABS) */}
        <div
          style={{
            padding: "0.85rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-card)",
          }}
        >
          {/* Filter Pills */}
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All Activity" },
              { key: "in_app", label: "⚡ In-App Payments" },
              { key: "external", label: "🌐 External Wallet" },
              { key: "inbound", label: "📥 Received" },
              { key: "outbound", label: "📤 Sent" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key as any)}
                className={`btn btn-sm ${filterType === tab.key ? "btn-primary" : "btn-outline"}`}
                style={{ fontSize: "0.74rem", height: "32px", borderRadius: "8px", fontWeight: 700 }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "220px", flex: 1, maxWidth: "320px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="input input-sm"
              placeholder="Search hash, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "32px", height: "32px", fontSize: "0.78rem", width: "100%" }}
            />
          </div>
        </div>

        {/* TRANSACTION LIST BODY */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {loading && transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.75rem auto" }} />
              <p style={{ fontSize: "0.85rem", margin: 0 }}>Querying Stellar Horizon Ledger...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3.5rem 1rem", color: "var(--text-muted)" }}>
              <Wallet size={36} style={{ margin: "0 auto 0.75rem auto", opacity: 0.4 }} />
              <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>
                No Transactions Found
              </h4>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>
                {searchQuery ? "No transactions match your search filter." : "This wallet address has no on-chain transactions yet."}
              </p>
            </div>
          ) : (
            filteredList.map((tx) => {
              const isInbound = tx.direction === "inbound";
              return (
                <div
                  key={tx.id}
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "14px",
                    padding: "0.9rem 1.15rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Left: Direction Icon & Info */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "10px",
                        background: isInbound ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: isInbound ? "#10b981" : "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isInbound ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>
                          {tx.title}
                        </span>
                        <span
                          className={`badge ${tx.paymentMethod === "in_app" ? "badge-info" : "badge-outline"}`}
                          style={{ fontSize: "0.65rem", padding: "0.15rem 0.45rem", fontWeight: 700 }}
                        >
                          {tx.paymentMethod === "in_app" ? "⚡ In-App Civic Key" : "🌐 External Wallet"}
                        </span>
                      </div>

                      <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tx.description}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.25rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        <span>{new Date(tx.timestamp).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        <span>•</span>
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--accent-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.15rem", fontWeight: 700 }}
                        >
                          <code>{tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}</code>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amounts & Official Receipt Action */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "1rem",
                          fontWeight: 900,
                          color: isInbound ? "#10b981" : "var(--text-primary)",
                        }}
                      >
                        {isInbound ? "+" : "-"}{tx.amountXlm} XLM
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        ≈ ₱{tx.amountPhp}
                      </div>
                    </div>

                    {/* Official PDF Receipt Button */}
                    <button
                      onClick={() => handleDownloadReceipt(tx)}
                      className="btn btn-sm btn-outline tap-scale"
                      style={{
                        height: "36px",
                        padding: "0 0.75rem",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        borderColor: "var(--role-accent)",
                        color: "var(--role-accent)",
                      }}
                      title="Download Official Government e-OR Receipt (PDF)"
                    >
                      <Download size={13} />
                      <span>PDF e-OR</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "0.85rem 1.5rem",
            background: "var(--bg-elevated)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <FileCheck2 size={14} style={{ color: "var(--accent-green)" }} />
            <span>Official Electronic Receipts powered by Stellar Soroban Distributed Ledger</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
