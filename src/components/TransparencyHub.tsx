import React, { useState } from "react";
import type { Project, EventLog } from "../types";
import { Search, Landmark } from "lucide-react";
import { formatXlmWithPhp, formatXlmToPhp } from "../utils/currency";

interface TransparencyHubProps {
  projects: Project[];
  eventLogs?: EventLog[];
}

export const TransparencyHub: React.FC<TransparencyHubProps> = ({
  projects,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const totalReleased = projects.reduce((sum, p) => {
    const b = parseFloat(p.budget);
    if (p.status === 1) return sum + b;
    const mobPct = p.mobilizationPct ?? 50;
    return sum + (b * mobPct) / 100;
  }, 0);

  const totalLocked = projects.reduce((sum, p) => {
    const b = parseFloat(p.budget);
    if (p.status === 1) return sum;
    if (p.status === 2) return sum;
    const mobPct = p.mobilizationPct ?? 50;
    return sum + (b * (100 - mobPct)) / 100;
  }, 0);

  const completedCount = projects.filter((p) => p.status === 1).length;

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

  const filteredProjects = projects.filter((p) => {
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
    <div className="bank-section">
      {/* 1. TOP TREASURY METRICS */}
      <div className="bank-stats-grid">
        <div className="bank-stat">
          <span className="bank-stat-label">Active Escrows Locked</span>
          <span className="bank-stat-value" style={{ color: "var(--role-accent)" }}>
            {totalLocked.toFixed(1)} XLM
          </span>
          <span className="bank-stat-desc">≈ {formatXlmToPhp(totalLocked)} secured on-chain</span>
        </div>

        <div className="bank-stat">
          <span className="bank-stat-label">Released Funds</span>
          <span className="bank-stat-value">
            {totalReleased.toFixed(1)} XLM
          </span>
          <span className="bank-stat-desc">≈ {formatXlmToPhp(totalReleased)} disbursed to SK</span>
        </div>

        <div className="bank-stat">
          <span className="bank-stat-label">Completed Escrows</span>
          <span className="bank-stat-value">
            {completedCount} / {projects.length}
          </span>
          <span className="bank-stat-desc">Milestones audited & finalized</span>
        </div>

        <div className="bank-stat">
          <span className="bank-stat-label">Quorum Consensus</span>
          <span className="bank-stat-value" style={{ color: "#f59e0b" }}>
            60%
          </span>
          <span className="bank-stat-desc">Mandatory citizen threshold</span>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search size={16} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search projects by title, ID, or creator address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "2.4rem" }}
          />
        </div>

        <div className="fintech-tabs-rail" style={{ padding: "0.2rem" }}>
          <button
            className={`fintech-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem" }}
          >
            All Projects ({projects.length})
          </button>
          <button
            className={`fintech-tab-btn ${statusFilter === "active" ? "active" : ""}`}
            onClick={() => setStatusFilter("active")}
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem" }}
          >
            Active ({projects.filter((p) => p.status === 0).length})
          </button>
          <button
            className={`fintech-tab-btn ${statusFilter === "completed" ? "active" : ""}`}
            onClick={() => setStatusFilter("completed")}
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem" }}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* 3. TREASURY STATEMENT & PROJECT ESCROW LIST */}
      <div className="bank-card">
        <div className="bank-card-header">
          <div>
            <h3 className="bank-card-title">Project Escrows Ledger</h3>
            <div className="bank-card-subtitle">On-Chain Smart Contract Allocations</div>
          </div>
          <span className="badge badge-info">{filteredProjects.length} Records</span>
        </div>

        <div className="bank-card-body">
          {filteredProjects.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "1rem 0", textAlign: "center" }}>
              No project escrows matching your search query.
            </p>
          ) : (
            <div className="bank-ledger-list">
              {filteredProjects.map((p) => {
                const currency = formatXlmWithPhp(p.budget);
                return (
                  <div key={p.id} className="bank-ledger-row">
                    <div className="bank-ledger-left">
                      <div className="bank-ledger-icon">
                        <Landmark size={20} />
                      </div>
                      <div className="bank-ledger-details">
                        <div className="bank-ledger-title">
                          #{p.id}: {p.name}
                        </div>
                        <div className="bank-ledger-sub">
                          <span>Creator:</span>
                          <code>{truncateAddress(p.creator)}</code>
                          <span>•</span>
                          <span>{p.description.slice(0, 48)}{p.description.length > 48 ? "..." : ""}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bank-ledger-right">
                      <div className="bank-ledger-amount credit">
                        {currency.phpStr}
                      </div>
                      <div className="bank-ledger-sub-amount">
                        <span>{currency.xlmStr}</span>
                        <span>•</span>
                        {getStatusBadge(p.status, p)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransparencyHub;
