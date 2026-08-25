import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Receipt,
  Inbox,
  Check,
  RefreshCw,
  Download,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Wallet,
  CheckCheck
} from "lucide-react";
import { db } from "../services/firebase";
import { collection, query, onSnapshot, doc, updateDoc, writeBatch } from "firebase/firestore";
import { walletTransactionService, type WalletTransaction } from "../services/walletTransaction.service";
import { generateOfficialReceiptPdf } from "../utils/receiptPdfGenerator";
import { useAuth } from "../contexts/AuthContext";
import { LoadingSpinner } from "./LoadingSpinner";

interface ActivityViewProps {
  userWalletAddress?: string;
  defaultTab?: "alerts" | "transactions";
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  userWalletAddress,
  defaultTab = "transactions",
}) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"alerts" | "transactions">(defaultTab);

  // 1. Alerts State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread" | "voting" | "account">("all");

  // 2. Transactions State
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "inbound" | "outbound" | "in_app">("all");

  const activeWallet = userWalletAddress || profile?.walletAddress || "";

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!profile?.uid) {
      setNotifLoading(false);
      return;
    }

    const q = query(collection(db, "notifications"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const matchesUser = data.targetUid === profile.uid;
          const matchesBarangay = !!data.barangayId && data.barangayId !== "N/A" && data.barangayId === profile.barangayId;
          const isBroadcast = !data.targetUid || data.targetUid === "all";

          if (matchesUser || matchesBarangay || isBroadcast) {
            list.push({ id: docSnap.id, ...data });
          }
        });

        list.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeB - timeA;
        });

        setNotifications(list);
        setNotifLoading(false);
      },
      (err) => {
        console.error("Notifications subscription error:", err);
        setNotifLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Fetch Wallet Transactions
  const fetchWalletHistory = useCallback(async () => {
    if (!activeWallet) return;
    setTxLoading(true);
    try {
      const data = await walletTransactionService.getWalletTransactions(
        activeWallet,
        profile?.walletAddress || undefined
      );
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setTxLoading(false);
    }
  }, [activeWallet, profile?.walletAddress]);

  useEffect(() => {
    if (activeWallet) {
      fetchWalletHistory();
    }
  }, [activeWallet, fetchWalletHistory]);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      const docRef = doc(db, "notifications", id);
      await updateDoc(docRef, { read: true });
    } catch (err: any) {
      console.warn("[ActivityView] Firestore sync notice:", err?.message || err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const docRef = doc(db, "notifications", n.id);
        batch.update(docRef, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleDownloadReceipt = (tx: WalletTransaction) => {
    generateOfficialReceiptPdf(tx, {
      userName: profile?.name || "Verified Citizen",
      barangayName: profile?.barangayName || profile?.barangayId || "Barangay Bond Escrow",
      role: profile?.role || "Resident",
    });
  };

  const unreadAlertsCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === "unread") return !n.read;
    if (notifFilter === "voting") return n.title?.toLowerCase().includes("vote") || n.message?.toLowerCase().includes("vote") || n.title?.toLowerCase().includes("milestone");
    if (notifFilter === "account") return n.title?.toLowerCase().includes("account") || n.title?.toLowerCase().includes("kyc") || n.title?.toLowerCase().includes("verified");
    return true;
  });

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.title.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (txFilter === "inbound") return tx.direction === "inbound";
    if (txFilter === "outbound") return tx.direction === "outbound";
    if (txFilter === "in_app") return tx.paymentMethod === "in_app";
    return true;
  });

  return (
    <div className="bank-section page-enter" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* 1. TOP HEADER & PILL TAB SWITCHER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            Activity Feed
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.2rem 0 0 0" }}>
            Track governance alerts, community updates, and your on-chain wallet history
          </p>
        </div>

        {/* GCash/Maya Style Pill Switcher */}
        <div className="fintech-tabs-rail" style={{ padding: "0.25rem" }}>
          <button
            className={`fintech-tab-btn ${activeTab === "transactions" ? "active" : ""}`}
            onClick={() => setActiveTab("transactions")}
            style={{ padding: "0.45rem 1.1rem", fontSize: "0.82rem", fontWeight: 800 }}
          >
            <Receipt size={15} style={{ marginRight: "0.35rem" }} />
            Transactions ({transactions.length})
          </button>

          <button
            className={`fintech-tab-btn ${activeTab === "alerts" ? "active" : ""}`}
            onClick={() => setActiveTab("alerts")}
            style={{ padding: "0.45rem 1.1rem", fontSize: "0.82rem", fontWeight: 800, position: "relative" }}
          >
            <Bell size={15} style={{ marginRight: "0.35rem" }} />
            Alerts
            {unreadAlertsCount > 0 && (
              <span
                style={{
                  marginLeft: "0.4rem",
                  background: "var(--accent-red)",
                  color: "#fff",
                  fontSize: "0.68rem",
                  padding: "0.1rem 0.45rem",
                  borderRadius: "9999px",
                  fontWeight: 900,
                }}
              >
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: TRANSACTIONS (MERGED WALLET LEDGER + OFFICIAL E-OR PDF RECEIPTS)
          ========================================================================= */}
      {activeTab === "transactions" && (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Controls Bar */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-elevated)",
            }}
          >
            {/* Filter Pills */}
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {[
                { key: "all", label: "All" },
                { key: "inbound", label: "📥 Received" },
                { key: "outbound", label: "📤 Sent" },
                { key: "in_app", label: "⚡ In-App Key" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTxFilter(tab.key as any)}
                  className={`btn btn-sm ${txFilter === tab.key ? "btn-primary" : "btn-outline"}`}
                  style={{ fontSize: "0.75rem", height: "32px", borderRadius: "8px", fontWeight: 700 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search & Refresh */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: "1 1 240px", maxWidth: "340px" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search hash, address, title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "32px", height: "34px", fontSize: "0.78rem" }}
                />
              </div>
              <button
                className="btn btn-sm btn-outline tap-scale"
                onClick={fetchWalletHistory}
                disabled={txLoading}
                title="Refresh Ledger"
                style={{ height: "34px", width: "34px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <RefreshCw size={13} className={txLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Summary Metric Strip for Transactions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", padding: "1rem 1.25rem 0 1.25rem" }}>
            <div className="stat-tile" style={{ padding: "0.75rem 1rem", borderRadius: "12px" }}>
              <span className="stat-tile-label">Total Volume</span>
              <span className="stat-tile-value" style={{ fontSize: "1.15rem" }}>
                {transactions.reduce((acc, t) => acc + (t.totalLessenXlm ?? (parseFloat(t.amountXlm?.replace(/,/g, "") || "0") || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM
              </span>
              <span className="stat-tile-sub">All logged transactions</span>
            </div>
            <div className="stat-tile" style={{ padding: "0.75rem 1rem", borderRadius: "12px" }}>
              <span className="stat-tile-label">Received Funds</span>
              <span className="stat-tile-value" style={{ fontSize: "1.15rem", color: "var(--accent-green)" }}>
                +{transactions.filter(t => t.direction === "inbound").reduce((acc, t) => acc + (t.totalLessenXlm ?? (parseFloat(t.amountXlm?.replace(/,/g, "") || "0") || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM
              </span>
              <span className="stat-tile-sub">{transactions.filter(t => t.direction === "inbound").length} inbound transfers</span>
            </div>
            <div className="stat-tile" style={{ padding: "0.75rem 1rem", borderRadius: "12px" }}>
              <span className="stat-tile-label">Sent / Disbursed</span>
              <span className="stat-tile-value" style={{ fontSize: "1.15rem", color: "var(--text-primary)" }}>
                -{transactions.filter(t => t.direction === "outbound").reduce((acc, t) => acc + (t.totalLessenXlm ?? (parseFloat(t.amountXlm?.replace(/,/g, "") || "0") || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM
              </span>
              <span className="stat-tile-sub">{transactions.filter(t => t.direction === "outbound").length} outbound transfers</span>
            </div>
          </div>

          {/* Transactions List */}
          <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {txLoading && transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                <LoadingSpinner size="md" label="Querying Stellar Ledger..." />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3.5rem 1rem", color: "var(--text-muted)" }}>
                <Wallet size={36} style={{ margin: "0 auto 0.75rem auto", opacity: 0.4 }} />
                <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>
                  No Transactions Found
                </h4>
                <p style={{ fontSize: "0.78rem", margin: 0 }}>
                  {searchQuery ? "No transactions match your search filter." : "This wallet address has no on-chain transactions yet."}
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isInbound = tx.direction === "inbound";
                return (
                  <div
                    key={tx.id}
                    className="stat-tile"
                    style={{
                      padding: "0.9rem 1.15rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1.25rem",
                      borderRadius: "14px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Left: Direction Icon & Details */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", flex: 1, minWidth: 0 }}>
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
                          marginTop: "2px",
                        }}
                      >
                        {isInbound ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {tx.title}
                          </span>
                          <span
                            className={`badge ${tx.paymentMethod === "in_app" ? "badge-info" : "badge-outline"}`}
                            style={{ fontSize: "0.62rem", padding: "0.1rem 0.4rem", fontWeight: 700 }}
                          >
                            {tx.paymentMethod === "in_app" ? "⚡ In-App Key" : "🌐 External"}
                          </span>
                        </div>

                        <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          {tx.description}
                        </p>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem", fontSize: "0.7rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                          <span>{new Date(tx.timestamp).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>•</span>
                          <span>Tx Hash:</span>
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--accent-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.15rem", fontWeight: 700 }}
                          >
                            <code>{tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}</code>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amounts & PDF e-OR Button */}
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
                        {tx.escrowAmountXlm ? (
                          <div style={{ fontSize: "0.68rem", color: "var(--role-accent)", marginTop: "0.15rem", fontWeight: 700 }}>
                            {tx.escrowAmountXlm} XLM Escrow + {tx.feePaidXlm} Fee
                          </div>
                        ) : tx.feePaidXlm ? (
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                            Fee: {tx.feePaidXlm} XLM
                          </div>
                        ) : null}
                      </div>

                      <button
                        onClick={() => handleDownloadReceipt(tx)}
                        className="btn btn-sm btn-outline tap-scale"
                        style={{
                          height: "36px",
                          padding: "0 0.85rem",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          borderColor: "var(--role-accent-border)",
                          color: "var(--role-accent)",
                        }}
                        title="Download Official Government e-OR Receipt (PDF)"
                      >
                        <Download size={13} />
                        <span>e-OR</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ALERTS (REAL-TIME GOVERNANCE & VOTING NOTIFICATIONS)
          ========================================================================= */}
      {activeTab === "alerts" && (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Controls Header */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-elevated)",
            }}
          >
            {/* Filter Pills */}
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {[
                { key: "all", label: "All Alerts" },
                { key: "unread", label: `Unread (${unreadAlertsCount})` },
                { key: "voting", label: "🗳️ Voting" },
                { key: "account", label: "👤 Account" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setNotifFilter(tab.key as any)}
                  className={`btn btn-sm ${notifFilter === tab.key ? "btn-primary" : "btn-outline"}`}
                  style={{ fontSize: "0.75rem", height: "32px", borderRadius: "8px", fontWeight: 700 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {unreadAlertsCount > 0 && (
              <button
                className="btn btn-sm btn-outline tap-scale"
                onClick={handleMarkAllAsRead}
                style={{ fontSize: "0.74rem", height: "32px", display: "inline-flex", alignItems: "center", gap: "0.35rem", fontWeight: 700 }}
              >
                <CheckCheck size={14} />
                <span>Mark All Read</span>
              </button>
            )}
          </div>

          {/* Summary Metric Strip for Alerts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", padding: "1rem 1.25rem 0 1.25rem" }}>
            <div className="stat-tile" style={{ padding: "0.75rem 1rem", borderRadius: "12px" }}>
              <span className="stat-tile-label">Total Notifications</span>
              <span className="stat-tile-value" style={{ fontSize: "1.15rem" }}>
                {notifications.length}
              </span>
              <span className="stat-tile-sub">All incoming broadcasts</span>
            </div>
            <div className="stat-tile" style={{ padding: "0.75rem 1rem", borderRadius: "12px" }}>
              <span className="stat-tile-label">Unread Alerts</span>
              <span className="stat-tile-value" style={{ fontSize: "1.15rem", color: unreadAlertsCount > 0 ? "var(--accent-red, #ef4444)" : "var(--accent-green)" }}>
                {unreadAlertsCount}
              </span>
              <span className="stat-tile-sub">{unreadAlertsCount > 0 ? "Requires your attention" : "All caught up"}</span>
            </div>
            <div className="stat-tile" style={{ padding: "0.75rem 1rem", borderRadius: "12px" }}>
              <span className="stat-tile-label">Voting Notices</span>
              <span className="stat-tile-value" style={{ fontSize: "1.15rem", color: "var(--role-accent)" }}>
                {notifications.filter(n => n.type === "voting" || n.title?.toLowerCase().includes("vote")).length}
              </span>
              <span className="stat-tile-sub">Active community ballots</span>
            </div>
          </div>

          {/* Alerts List */}
          <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {notifLoading ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <LoadingSpinner size="md" label="Loading alerts..." />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3.5rem 1rem", color: "var(--text-muted)" }}>
                <Inbox size={36} style={{ margin: "0 auto 0.75rem auto", opacity: 0.35 }} />
                <p style={{ fontSize: "0.85rem", margin: 0 }}>No alerts found in this filter.</p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const timeVal = n.createdAt || n.timestamp;
                return (
                  <div
                    key={n.id}
                    style={{
                      background: n.read ? "var(--bg-elevated)" : "var(--bg-hover)",
                      border: "1px solid",
                      borderColor: n.read ? "var(--border-subtle)" : "var(--role-accent-border)",
                      borderRadius: "14px",
                      padding: "0.85rem 1rem",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", minWidth: 0 }}>
                      {!n.read && (
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "var(--role-accent)",
                            flexShrink: 0,
                            marginTop: "6px",
                          }}
                        />
                      )}
                      <div>
                        <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--text-primary)" }}>
                          {n.title}
                        </span>
                        <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                        <span style={{ display: "block", marginTop: "0.3rem", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                          {timeVal ? new Date(timeVal).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    </div>

                    {!n.read && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm tap-scale"
                        onClick={() => handleMarkAsRead(n.id)}
                        style={{ height: "28px", fontSize: "0.7rem", padding: "0 0.5rem", flexShrink: 0 }}
                      >
                        <Check size={11} /> Mark Read
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityView;
