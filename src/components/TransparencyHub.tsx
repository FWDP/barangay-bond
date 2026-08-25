import React, { useState } from "react";
import type { Project, EventLog } from "../types";
import { Search, Landmark, ExternalLink } from "lucide-react";
import { formatXlmWithPhp, formatXlmToPhp } from "../utils/currency";
import { STELLAR_CONFIG } from "../configuration/config";

interface TransparencyHubProps {
  projects: Project[];
  eventLogs?: EventLog[];
  userWalletAddress?: string;
}

export const TransparencyHub: React.FC<TransparencyHubProps> = ({
  projects,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Scoped to active contract instance
  const contractProjects = projects.filter(
    (p) => !p.contractId || p.contractId === STELLAR_CONFIG.contractId
  );

  const totalReleased = contractProjects.reduce((sum, p) => {
    const b = parseFloat(p.budget);
    if (p.status === 1) return sum + b;
    const mobPct = p.mobilizationPct ?? 50;
    return sum + (b * mobPct) / 100;
  }, 0);

  const totalLocked = contractProjects.reduce((sum, p) => {
    const b = parseFloat(p.budget);
    if (p.status === 1) return sum;
    if (p.status === 2) return sum;
    const mobPct = p.mobilizationPct ?? 50;
    return sum + (b * (100 - mobPct)) / 100;
  }, 0);

  const completedCount = contractProjects.filter((p) => p.status === 1).length;

  const truncateAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const getStatusBadge = (status: number, proj?: Project) => {
    if (status === 1) {
      return <span className="badge badge-success">✓ Completed</span>;
    }
    if (status === 2) {
      return <span className="badge badge-danger">Refunded</span>;
    }
    const currentMs = proj?.milestones?.find((m) => m.index === proj.currentPhase);
    if (currentMs?.status === 1) {
      return <span className="badge badge-warning">⚡ Voting Active</span>;
    }
    return <span className="badge badge-info">Phase {proj?.currentPhase || 1} Active</span>;
  };

  const filteredProjects = contractProjects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toString().includes(searchQuery) ||
      p.creator.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "completed") return matchesSearch && p.status === 1;
    if (statusFilter === "active") return matchesSearch && p.status === 0;
    return matchesSearch;
  });

  return (
    <div className="bank-section page-enter" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* 1. SECTION HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            Public Project Funds & Ledger
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.2rem 0 0 0" }}>
            Real-time records of community project funds held and released on Stellar
          </p>
        </div>
        <span className="badge badge-info">
          Stellar Network Verified
        </span>
      </div>

      {/* 2. TOP TREASURY METRICS */}
      <div className="stats-grid-3">
        <div className="stat-tile">
          <span className="stat-tile-label">Funds Reserved</span>
          <span className="stat-tile-value" style={{ color: "var(--role-accent)" }}>
            {totalLocked.toFixed(1)} XLM
          </span>
          <span className="stat-tile-sub">≈ {formatXlmToPhp(totalLocked)}</span>
        </div>

        <div className="stat-tile">
          <span className="stat-tile-label">Funds Released</span>
          <span className="stat-tile-value">
            {totalReleased.toFixed(1)} XLM
          </span>
          <span className="stat-tile-sub">≈ {formatXlmToPhp(totalReleased)}</span>
        </div>

        <div className="stat-tile">
          <span className="stat-tile-label">Completed Projects</span>
          <span className="stat-tile-value">
            {completedCount} / {contractProjects.length}
          </span>
          <span className="stat-tile-sub">Approved & finished</span>
        </div>
      </div>

      {/* 3. SEARCH & STATUS FILTER CONTROLS */}
      <div className="section-card" style={{ padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: "420px" }}>
          <Search size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search projects by title, ID, or creator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "2.4rem", height: "36px", fontSize: "0.82rem" }}
          />
        </div>

        <div className="fintech-tabs-rail" style={{ padding: "0.2rem" }}>
          <button
            className={`fintech-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem", fontWeight: 700 }}
          >
            All ({contractProjects.length})
          </button>
          <button
            className={`fintech-tab-btn ${statusFilter === "active" ? "active" : ""}`}
            onClick={() => setStatusFilter("active")}
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem", fontWeight: 700 }}
          >
            Active ({contractProjects.filter((p) => p.status === 0).length})
          </button>
          <button
            className={`fintech-tab-btn ${statusFilter === "completed" ? "active" : ""}`}
            onClick={() => setStatusFilter("completed")}
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem", fontWeight: 700 }}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* 4. PROJECT ESCROW LIST */}
      <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-elevated)" }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Project Allocations
          </h3>
          <span className="badge badge-outline">{filteredProjects.length} Records</span>
        </div>

        <div style={{ padding: "0.75rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {filteredProjects.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "2rem 0", textAlign: "center" }}>
              No project escrows matching your search query.
            </p>
          ) : (
            filteredProjects.map((p) => {
              const currency = formatXlmWithPhp(p.budget);
              return (
                <div
                  key={p.id}
                  className="stat-tile"
                  style={{
                    padding: "0.85rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                    borderRadius: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "var(--role-accent-soft)",
                        color: "var(--role-accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Landmark size={18} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>
                        #{p.id}: {p.name}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.15rem", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        <span>Creator:</span>
                        <a
                          href={`https://stellar.expert/explorer/testnet/account/${p.creator}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--accent-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.15rem", fontWeight: 700 }}
                          title="View on Stellar Expert"
                        >
                          <code>{truncateAddress(p.creator)}</code>
                          <ExternalLink size={9} />
                        </a>
                        <span>•</span>
                        <span>{p.description.slice(0, 48)}{p.description.length > 48 ? "..." : ""}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0, marginLeft: "auto" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--text-primary)" }}>
                        {currency.phpStr}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {currency.xlmStr}
                      </div>
                    </div>

                    {getStatusBadge(p.status, p)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TransparencyHub;
