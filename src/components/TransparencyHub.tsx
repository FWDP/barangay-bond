import React from "react";
import type { Project, EventLog } from "../types";

interface TransparencyHubProps {
  projects: Project[];
  eventLogs: EventLog[];
}

export const TransparencyHub: React.FC<TransparencyHubProps> = ({
  projects,
  eventLogs,
}) => {
  // Compute basic project stats
  
  // Total budget locked: sum of budget of all projects
  const totalEscrowLockedStroops = projects.reduce((sum, p) => {
    // If project is completed (status === 2), the entire budget is released.
    // If project is active (status === 0 or 1), 50% is locked in escrow.
    if (p.status === 2) {
      return sum;
    }
    const totalBudget = parseFloat(p.budget);
    return sum + (totalBudget / 2);
  }, 0);

  const activeCount = projects.filter((p) => p.status < 2).length;
  const completedCount = projects.filter((p) => p.status === 2).length;

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

  return (
    <div className="transparency-hub">
      {/* Overview Cards */}
      <div className="stats-row grid-3 mb-4">
        <div className="stats-card">
          <span className="stats-title">Active Escrow Locked</span>
          <span className="stats-value">{totalEscrowLockedStroops.toFixed(2)} XLM</span>
          <span className="stats-desc">Funds safely stored in smart contract</span>
        </div>
        <div className="stats-card">
          <span className="stats-title">Ongoing Audits</span>
          <span className="stats-value">{activeCount} Projects</span>
          <span className="stats-desc">Active youth governance projects</span>
        </div>
        <div className="stats-card">
          <span className="stats-title">Completed Projects</span>
          <span className="stats-value">{completedCount} Released</span>
          <span className="stats-desc">100% milestone verified and paid</span>
        </div>
      </div>

      <div className="hub-layout grid-2">
        {/* Project Ledger catalog */}
        <div className="panel-card">
          <h2 className="panel-title">Project Accountability Catalog</h2>
          <p className="panel-subtitle mb-3">All community projects registered on the Stellar blockchain.</p>

          {projects.length === 0 ? (
            <div className="empty-panel-state">
              <p>No project ledgers have been created on-chain yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Project Name</th>
                    <th>Escrow (XLM)</th>
                    <th>SK Creator</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>
                        <div className="ledger-proj-name">{p.name}</div>
                        <div className="ledger-proj-desc">{p.description}</div>
                      </td>
                      <td className="font-bold">{p.budget}</td>
                      <td title={p.creator}>{truncateAddress(p.creator)}</td>
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
          <h2 className="panel-title">Live On-Chain Event Feed</h2>
          <p className="panel-subtitle mb-3">Real-time ledger audit notifications synchronized directly from Stellar Testnet.</p>

          <div className="event-logs-feed">
            {eventLogs.length === 0 ? (
              <div className="empty-feed-state">
                <p>Waiting for blockchain transactions... The feed will automatically populate when operations occur.</p>
              </div>
            ) : (
              eventLogs.map((log) => (
                <div key={log.id} className={`event-log-item log-type-${log.type}`}>
                  <div className="event-log-header">
                    <span className="event-log-badge">{log.type.toUpperCase()}</span>
                    <span className="event-log-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="event-log-details">{log.details}</p>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${log.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-log-hash-link"
                  >
                    TX: {log.txHash.slice(0, 8)}...{log.txHash.slice(-8)} ↗
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
