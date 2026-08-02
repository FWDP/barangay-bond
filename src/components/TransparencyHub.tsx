import React, { useState } from "react";
import type { Project, EventLog } from "../types";
import { Search, TrendingUp, DollarSign, Award } from "lucide-react";

interface TransparencyHubProps {
  projects: Project[];
  eventLogs: EventLog[];
}

export const TransparencyHub: React.FC<TransparencyHubProps> = ({
  projects,
  eventLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Compute stats
  const totalBudget = projects.reduce((sum, p) => sum + parseFloat(p.budget), 0);
  
  // released is 50% for active projects (status 0,1), 100% for status 2
  const totalReleased = projects.reduce((sum, p) => {
    const b = parseFloat(p.budget);
    if (p.status === 2) return sum + b;
    return sum + (b / 2);
  }, 0);

  const totalLocked = totalBudget - totalReleased;
  
  const completedCount = projects.filter((p) => p.status === 2).length;
  
  const completionRate = projects.length > 0 ? completedCount / projects.length : 0;

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  const getStatusBadge = (status: number) => {
    if (status === 2) {
      return <span className="badge badge-success">Completed (Released)</span>;
    }
    if (status === 1) {
      return <span className="badge badge-warning">Audit Voting</span>;
    }
    return <span className="badge badge-info">Phase 1 Mobilized</span>;
  };

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toString().includes(searchQuery) ||
      p.creator.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "completed") return matchesSearch && p.status === 2;
    if (statusFilter === "active") return matchesSearch && p.status < 2;
    return matchesSearch;
  });

  return (
    <div className="transparency-hub">
      {/* Dynamic LGU Statistics Row */}
      <div className="stats-row grid-3 mb-4">
        <div className="stats-card">
          <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <DollarSign size={16} /> Escrow Funds Active
          </span>
          <span className="stats-value">{totalLocked.toFixed(2)} XLM</span>
          <span className="stats-desc">Safely locked in Stellar contract escrows</span>
        </div>
        <div className="stats-card">
          <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <TrendingUp size={16} /> Total Budget Released
          </span>
          <span className="stats-value">{totalReleased.toFixed(2)} XLM</span>
          <span className="stats-desc">Pledged to verified milestone contractors</span>
        </div>
        <div className="stats-card">
          <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Award size={16} /> Projects Audited
          </span>
          <span className="stats-value">{completedCount} Completed</span>
          <span className="stats-desc">Out of {projects.length} proposed initiatives</span>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid-2 mb-4">
        {/* Budget Allocation Progress Bar */}
        <div className="panel-card" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <h3 className="stats-title">Budget Allocation Split</h3>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
            <span>Locked: <strong>{totalLocked.toFixed(2)} XLM</strong></span>
            <span>Released: <strong>{totalReleased.toFixed(2)} XLM</strong></span>
          </div>
          <div className="progress-bar-bg" style={{ height: "16px", borderRadius: "8px" }}>
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${totalBudget > 0 ? (totalReleased / totalBudget) * 100 : 0}%`, 
                height: "100%", 
                borderRadius: "8px",
                background: "linear-gradient(90deg, var(--role-accent, var(--primary)) 0%, #a7f3d0 100%)" 
              }} 
            />
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
            💡 SK Projects automatically receive a 50% mobilization release upon budget lock. The remaining 50% triggers once the community votes to verify Phase 1 proofs.
          </p>
        </div>

        {/* Milestone Verification Success & Trends Charts */}
        <div className="panel-card" style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <div style={{ flexShrink: 0 }}>
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <circle 
                cx="60" 
                cy="60" 
                r="50" 
                fill="none" 
                stroke="var(--role-accent, #2563eb)" 
                strokeWidth="10" 
                strokeDasharray="314.15" 
                strokeDashoffset={314.15 * (1 - completionRate)} 
                transform="rotate(-90 60 60)" 
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
              <text x="60" y="66" textAnchor="middle" fontSize="1.1rem" fontWeight="700" fill="#0F172A">
                {Math.round(completionRate * 100)}%
              </text>
            </svg>
          </div>
          <div>
            <h3 className="panel-title">Audit Completion Rate</h3>
            <p className="panel-subtitle" style={{ marginBottom: "0.5rem" }}>Ratio of fully completed escrows relative to proposed projects.</p>
            <div className="badge badge-success">Consensus Threshold: 2 approvals</div>
          </div>
        </div>
      </div>

      {/* SVG Timeline curves */}
      <div className="panel-card mb-4">
        <h3 className="stats-title" style={{ marginBottom: "1rem" }}>Youth Resident Voting Participation Curve</h3>
        <div className="chart-container-svg">
          <svg viewBox="0 0 800 120" style={{ width: "100%", height: "auto" }}>
            {/* Grid background */}
            <line x1="0" y1="120" x2="800" y2="120" stroke="#cbd5e1" strokeWidth="1" />
            <line x1="0" y1="60" x2="800" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
            <line x1="0" y1="0" x2="800" y2="0" stroke="#cbd5e1" strokeWidth="1" />
            
            {/* Area gradient under path */}
            <path d="M 0 110 Q 150 20 300 90 T 600 40 T 800 10 L 800 120 L 0 120 Z" fill="rgba(37, 99, 235, 0.03)" />
            
            {/* Trend curve line */}
            <path d="M 0 110 Q 150 20 300 90 T 600 40 T 800 10" fill="none" stroke="var(--role-accent, #2563eb)" strokeWidth="3" />
            
            {/* Interactive node indicator */}
            <circle cx="300" cy="90" r="5" fill="var(--role-accent, #2563eb)" />
            <circle cx="600" cy="40" r="5" fill="var(--role-accent, #2563eb)" />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <span>Project Inception</span>
            <span>Milestone 1 Proof Submitted</span>
            <span>Consensus Reached</span>
            <span>Tranche 2 Escrow Released</span>
          </div>
        </div>
      </div>

      <div className="hub-layout grid-2">
        {/* Project Accountability catalog */}
        <div className="panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h2 className="panel-title">LGU Project Catalog</h2>
              <p className="panel-subtitle" style={{ margin: 0 }}>Escrow tracking ledger of all community projects.</p>
            </div>
            {/* Filters */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select 
                className="form-control" 
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", width: "auto" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Projects</option>
                <option value="active">Active Escrows</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: "relative", marginBottom: "1.2rem" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: "2.5rem", fontSize: "0.88rem" }}
              placeholder="Search by project name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredProjects.length === 0 ? (
            <div className="empty-panel-state">
              <p>No project ledgers match your filter search.</p>
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: "400px", overflowY: "auto" }}>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Escrow</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="ledger-proj-name" style={{ fontWeight: 700 }}>{p.name}</div>
                        <div className="ledger-proj-desc" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{p.description}</div>
                        <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                          SK: {truncateAddress(p.creator)}
                        </div>
                      </td>
                      <td className="font-bold" style={{ whiteSpace: "nowrap" }}>{p.budget} XLM</td>
                      <td>{getStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Real-time event log */}
        <div className="panel-card">
          <h2 className="panel-title">On-Chain Activity Timeline</h2>
          <p className="panel-subtitle">Real-time ledger events synchronized directly from Stellar Testnet RPC.</p>

          <div style={{ maxHeight: "460px", overflowY: "auto", paddingRight: "0.5rem" }}>
            {eventLogs.length === 0 ? (
              <div className="empty-panel-state">
                <p>Waiting for blockchain transactions... Logs will auto-populate as votes or allocations hit the network.</p>
              </div>
            ) : (
              <div className="tx-timeline" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {eventLogs.map((log) => (
                  <div key={log.id} className="timeline-item" style={{ display: "flex", gap: "1rem", position: "relative" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div className="timeline-dot" style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--role-accent, var(--primary))", flexShrink: 0 }} />
                      <div style={{ width: "2px", flex: 1, background: "#e2e8f0" }} />
                    </div>
                    <div className="timeline-content" style={{ flex: 1, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                        <span className="badge badge-info" style={{ fontSize: "0.65rem" }}>{log.type.toUpperCase()}</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.88rem", color: "var(--text-primary)", lineHeight: "1.4" }}>{log.details}</p>
                      <div style={{ marginTop: "0.6rem", borderTop: "1px dashed #cbd5e1", paddingTop: "0.4rem" }}>
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${log.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link-badge"
                          style={{ fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                        >
                          TX: {log.txHash.slice(0, 8)}...{log.txHash.slice(-8)} ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
