import React from "react";
import { voteMilestone } from "../transactions/transactions";
import type { Project, TransactionStatus } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useWallet } from "../contexts/WalletContext";
import { ShieldAlert, FileText } from "lucide-react";

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
  const { profile } = useAuth();
  const { connected } = useWallet();

  const projectsAwaitingVotes = projects.filter(
    (p) => p.status === 1 && p.milestone1Status === 1
  );

  const handleVote = (projectId: number, approve: boolean) => {
    onExecute((onStatusChange) => {
      return voteMilestone(voterAddress, projectId, 1, approve, onStatusChange);
    });
  };

  // Determine eligibility
  const isVoter = profile?.role === "youth";
  const isPending = profile?.verificationStatus === "pending";

  return (
    <div className="youth-dashboard" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Welcome & Civic Status Billboard */}
      <div className="panel-card" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#ffffff", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.5px" }}>
            Mabuhay, {profile?.name || "Resident"}!
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: "0.25rem", maxWidth: "480px" }}>
            Welcome to the Central Barangay Youth Council Portal. Thank you for auditing our public fund releases.
          </p>
          {/* Announcements billboard */}
          <div style={{ marginTop: "1rem", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", padding: "0.85rem 1.1rem", borderRadius: "10px", fontSize: "0.82rem" }}>
            📌 <strong>Community Notice:</strong> SK Special Assembly on WiFi escrows scheduled next Tuesday at 6 PM. All registered residents are encouraged to attend.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "220px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <span style={{ color: "#94a3b8" }}>Identity:</span>
            {isPending ? (
              <span className="badge badge-warning" style={{ fontSize: "0.7rem" }}>Pending Verification</span>
            ) : isVoter ? (
              <span className="badge badge-success" style={{ fontSize: "0.7rem" }}>Verified Youth Resident</span>
            ) : (
              <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>Approved Viewer</span>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <span style={{ color: "#94a3b8" }}>Wallet:</span>
            {connected ? (
              <span style={{ color: "#10b981", fontWeight: 600 }}>Connected</span>
            ) : (
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>Needs Wallet Link</span>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <span style={{ color: "#94a3b8" }}>Voting Right:</span>
            {isVoter ? (
              <span style={{ color: "#14f195", fontWeight: 700 }}>Eligible Voter</span>
            ) : (
              <span style={{ color: "#cbd5e1" }}>Read-Only Auditor</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace projects area */}
      <div>
        <h3 className="panel-title" style={{ marginBottom: "0.5rem" }}>Projects Seeking Verification</h3>
        <p className="panel-subtitle">Review construction documents, invoices, and photos below. Approve to release remaining tranche escrows.</p>

        {projectsAwaitingVotes.length === 0 ? (
          <div className="empty-panel-state">
            <ShieldAlert size={48} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
            <h3>No Active Milestones Under Evaluation</h3>
            <p className="mt-2 text-secondary" style={{ maxWidth: "480px", margin: "0 auto 1.5rem auto" }}>
              All project escrows are currently locked or fully completed. You will receive an alert when a builder submits new proofs.
            </p>
          </div>
        ) : (
          <div className="projects-grid">
            {projectsAwaitingVotes.map((p) => (
              <div key={p.id} className="panel-card" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-info">Initiative #{p.id}</span>
                  <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--role-accent, var(--primary))" }}>{p.budget} XLM</span>
                </div>

                <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>{p.name}</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>{p.description}</p>

                {/* Audit proof document placeholder files */}
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>Verifiable Proof Attachments</span>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "var(--role-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText size={18} style={{ color: "var(--role-accent)" }} />
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <a 
                        href={p.milestone1Proof} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="proof-link-badge"
                        style={{ fontSize: "0.85rem", fontWeight: 700, wordBreak: "break-all" }}
                      >
                        milestone1_deliverables_proof.pdf ↗
                      </a>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Submitted by SK Chairman</div>
                    </div>
                  </div>
                </div>

                {/* Voting Progress bar */}
                <div className="voting-progress-section" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                  <div className="progress-labels" style={{ marginBottom: "0.4rem" }}>
                    <span>Approvals: <strong>{p.milestone1VotesApprove} / 2</strong></span>
                    <span>Rejections: <strong>{p.milestone1VotesReject}</strong></span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: "8px" }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min((p.milestone1VotesApprove / 2) * 100, 100)}%`,
                        background: "var(--role-accent, var(--primary))"
                      }}
                    />
                  </div>
                </div>

                {/* Voter action button checks */}
                {isVoter ? (
                  <div className="voting-action-row" style={{ marginTop: "0.5rem" }}>
                    <button
                      className="btn btn-primary flex-grow"
                      onClick={() => handleVote(p.id, true)}
                    >
                      Approve Release
                    </button>
                    <button
                      className="btn btn-outline-danger flex-grow"
                      onClick={() => handleVote(p.id, false)}
                    >
                      Reject Release
                    </button>
                  </div>
                ) : (
                  <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #cbd5e1", padding: "0.75rem", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "center", fontWeight: 500 }}>
                    🔒 Voter signatures restricted to approved residents aged 15-30.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
