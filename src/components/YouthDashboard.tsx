import React from "react";
import { voteMilestone } from "../transactions/transactions";
import type { Project, TransactionStatus } from "../types";

interface YouthDashboardProps {
  voterAddress: string;
  projects: Project[];
  onExecute: (
    actionFn: (
      onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
    ) => Promise<string>
  ) => void;
}

export const YouthDashboard: React.FC<YouthDashboardProps> = ({
  voterAddress,
  projects,
  onExecute,
}) => {
  // Filter projects currently undergoing milestone evaluation (status === 1)
  const projectsAwaitingVotes = projects.filter(
    (p) => p.status === 1 && p.milestone1Status === 1
  );

  const handleVote = (projectId: number, approve: boolean) => {
    onExecute((onStatusChange) => {
      return voteMilestone(voterAddress, projectId, 1, approve, onStatusChange);
    });
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <div className="youth-dashboard">
      <h2 className="panel-title">Youth Resident Governance</h2>
      <p className="panel-subtitle mb-4">
        Audit milestone deliverables and cast your vote. Projects require at least 2 approval votes to release funds.
      </p>

      {projectsAwaitingVotes.length === 0 ? (
        <div className="empty-dashboard-state">
          <p>No active projects are currently seeking milestone approval votes.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projectsAwaitingVotes.map((p) => (
            <div key={p.id} className="project-governance-card">
              <div className="proj-header-row">
                <span className="proj-id-tag">Project #{p.id}</span>
                <span className="proj-budget-tag">{p.budget} XLM</span>
              </div>
              <h3 className="proj-title">{p.name}</h3>
              <p className="proj-description">{p.description}</p>
              <div className="proj-metadata">
                <div>
                  <span className="meta-label">Creator:</span>
                  <span className="meta-value" title={p.creator}>
                    {truncateAddress(p.creator)}
                  </span>
                </div>
                <div>
                  <span className="meta-label">Milestone Proof:</span>
                  <a
                    href={p.milestone1Proof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-link-badge"
                  >
                    View Proof Document ↗
                  </a>
                </div>
              </div>

              {/* Voting Progress bar */}
              <div className="voting-progress-section">
                <div className="progress-labels">
                  <span>Approvals: {p.milestone1VotesApprove} / 2</span>
                  <span>Rejections: {p.milestone1VotesReject}</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(
                        (p.milestone1VotesApprove / 2) * 100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="voting-action-row">
                <button
                  className="btn btn-success flex-grow"
                  onClick={() => handleVote(p.id, true)}
                >
                  Approve Milestone
                </button>
                <button
                  className="btn btn-danger flex-grow"
                  onClick={() => handleVote(p.id, false)}
                >
                  Reject Milestone
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
