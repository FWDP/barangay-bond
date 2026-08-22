import React, { useState, useEffect } from "react";
import { voteMilestone } from "../transactions/transactions";
import type { Project, TransactionStatus, ProjectProposal } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { proposalRepository } from "../repositories/proposal.repository";
import { ThumbsUp, ThumbsDown, Sparkles, ExternalLink, ShieldCheck, Check, Clock } from "lucide-react";
import { formatXlmWithPhp } from "../utils/currency";

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
  const { profile, dbUsers } = useAuth();
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [votedProjects, setVotedProjects] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    try {
      const activeAddress = profile?.walletAddress || voterAddress || "";
      projects.forEach((p) => {
        const currentMs = p.currentPhase || 2;
        const vNew = localStorage.getItem(`voted_proj_${p.id}_${currentMs}_${activeAddress}`);
        const vOld = localStorage.getItem(`voted_proj_${p.id}_${activeAddress}`);
        if (vNew === "true" || vOld === "true") {
          initial[p.id] = true;
        }
      });
    } catch (e) {
      console.error(e);
    }
    return initial;
  });

  useEffect(() => {
    if (!profile?.barangayId) return;
    const unsubscribe = proposalRepository.subscribeToProposals(profile.barangayId, (data) => {
      setProposals(data);
    });
    return () => unsubscribe();
  }, [profile?.barangayId]);

  // Filter projects by Barangay jurisdiction
  const localProjects = projects.filter((p) => {
    return proposals.some(
      (prop) =>
        prop.onChainProjectId === p.id ||
        (p.name.toLowerCase() === prop.projectName.toLowerCase() &&
          prop.skOfficialAddress.toLowerCase() === p.creator.toLowerCase())
    );
  });

  // Eligible projects awaiting citizen vote on active milestone
  const projectsAwaitingVotes = localProjects.filter((p) => {
    if (p.status !== 0) return false;
    const currentMs = p.milestones?.find((ms) => ms.index === p.currentPhase);
    return currentMs ? currentMs.status === 1 : p.milestone1Status === 1;
  });

  // Calculate quorum
  const activeCount = dbUsers.filter((u) => {
    return (
      u.role === "resident" &&
      u.barangayId === profile?.barangayId &&
      u.verificationStatus === "approved"
    );
  }).length || 3;

  const requiredQuorumVotes = Math.max(Math.ceil(activeCount * 0.6), 2);

  const getAge = (birthdateStr?: string) => {
    if (!birthdateStr) return 0;
    const birthDate = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleVote = (projectId: number, approve: boolean) => {
    const targetProj = projects.find((p) => p.id === projectId);
    const milestoneIndex = targetProj ? targetProj.currentPhase : 2;

    onExecute(async (onStatusChange) => {
      try {
        const targetVoterAddress = profile?.walletAddress || voterAddress;
        const txHash = await voteMilestone(
          targetVoterAddress,
          projectId,
          milestoneIndex,
          approve,
          onStatusChange
        );

        setVotedProjects((prev) => ({ ...prev, [projectId]: true }));
        try {
          localStorage.setItem(`voted_proj_${projectId}_${milestoneIndex}_${targetVoterAddress}`, "true");
        } catch (e) {
          console.error(e);
        }
        return txHash;
      } catch (err: any) {
        console.error("Failed to vote:", err);
        throw err;
      }
    });
  };

  const age = getAge(profile?.birthdate);
  const isOveragedOrUnderaged = profile?.role === "resident" && (age < 15 || age > 30);
  const isVerifiedResident =
    profile?.role === "resident" &&
    profile.verified === true &&
    (profile.status === "active" || profile.verificationStatus === "approved") &&
    !isOveragedOrUnderaged;

  return (
    <div className="bank-section">
      {/* SECTION HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            Civic Escrow Portfolio
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem", margin: "0.2rem 0 0 0" }}>
            Audit contractor deliverables and authorize milestone disbursements on Stellar.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <span className="badge badge-role">
            Quorum Threshold: 60%
          </span>
          <span className="badge badge-info">
            {projectsAwaitingVotes.length} Active Escrows
          </span>
        </div>
      </div>

      {/* OVERAGED / GUEST AUDITOR BANNER */}
      {isOveragedOrUnderaged && (
        <div className="bank-card" style={{ borderLeft: "4px solid var(--accent-blue)", padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <ShieldCheck size={18} style={{ color: "var(--accent-blue)" }} />
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              <strong>Permanent Public Auditor:</strong> SK voting rights are scoped for 15-30 youth residents. Your account has permanent read-only audit access.
            </div>
          </div>
        </div>
      )}

      {/* NO ACTIVE ESCROWS STATE */}
      {projectsAwaitingVotes.length === 0 ? (
        <div className="bank-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem auto", color: "var(--role-accent)" }}>
            <Sparkles size={24} />
          </div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.4rem 0" }}>
            All Project Escrows are Current
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "440px", margin: "0 auto" }}>
            There are currently no active milestone proofs awaiting resident voting. Check the Public Ledger tab to inspect all deployed community projects.
          </p>
        </div>
      ) : (
        /* ACTIVE ESCROW APPROVAL CARDS */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.25rem" }}>
          {projectsAwaitingVotes.map((p) => {
            const hasVoted = !!votedProjects[p.id];
            const currentMs = p.milestones?.find((ms) => ms.index === p.currentPhase);
            const totalVotes = (currentMs?.votesApprove ?? (p.milestone1VotesApprove ?? 0)) + (currentMs?.votesReject ?? (p.milestone1VotesReject ?? 0));
            const quorumProgress = Math.min((totalVotes / requiredQuorumVotes) * 100, 100);
            const currencyObj = formatXlmWithPhp(p.budget);

            return (
              <div key={p.id} className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
                {/* 1. Project Title & Contractor */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Project Escrow #{p.id}
                    </span>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.15rem 0 0 0" }}>
                      {p.name}
                    </h3>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      Proposer: <code style={{ color: "var(--text-secondary)" }}>{p.creator.slice(0, 6)}...{p.creator.slice(-4)}</code>
                    </div>
                  </div>
                  <span className="badge badge-warning" style={{ fontSize: "0.68rem" }}>
                    Voting Active
                  </span>
                </div>

                {/* 2. Escrow Amount & Milestone Tranche */}
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "0.9rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
                      Phase {p.currentPhase || 2} Tranche Release
                    </span>
                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--role-accent)", marginTop: "0.1rem" }}>
                      {currencyObj.phpStr}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>Escrow Locked</span>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                      {currencyObj.xlmStr}
                    </div>
                  </div>
                </div>

                {/* 3. Deliverable Scope */}
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  {p.description}
                </p>

                {/* 4. Quorum Progress Gauge (60% Marker) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
                    <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>Community Approval</span>
                    <strong style={{ color: "var(--text-primary)" }}>{totalVotes} / {requiredQuorumVotes} Votes ({Math.round(quorumProgress)}%)</strong>
                  </div>
                  <div className="quorum-track">
                    <div className="quorum-fill" style={{ width: `${quorumProgress}%` }} />
                    <div className="quorum-threshold-marker" title="60% Quorum Line" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <span>0%</span>
                    <span style={{ color: "#f59e0b", fontWeight: 700 }}>60% Quorum Target</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* 5. Escrow Financial Checklist */}
                <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "0.75rem 0.9rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--accent-green)" }}>
                    <Check size={13} />
                    <span>Phase 1 Mobilization Disbursed on Deploy</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--accent-green)" }}>
                    <Check size={13} />
                    <span>Contractor Uploaded Phase {p.currentPhase || 2} Deliverables Proof</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)" }}>
                    <Clock size={13} style={{ color: "#f59e0b" }} />
                    <span>Awaiting 60% Youth Resident Consensus</span>
                  </div>
                </div>

                {/* 6. Deliverable Documentation Link */}
                {currentMs?.proofUrl && (
                  <a
                    href={currentMs.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm w-100"
                    style={{ justifyContent: "center" }}
                  >
                    <ExternalLink size={13} /> View Contractor Proof Documentation
                  </a>
                )}

                {/* 7. ONE DOMINANT ACTION (APPROVE / REJECT) */}
                {hasVoted ? (
                  <div style={{ background: "var(--role-accent-soft)", border: "1px solid var(--role-accent-border)", borderRadius: "12px", padding: "0.75rem", textAlign: "center", color: "var(--role-badge-color)", fontSize: "0.85rem", fontWeight: 800 }}>
                    ✓ Cryptographic Vote Recorded on Stellar Ledger
                  </div>
                ) : !isVerifiedResident ? (
                  <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "0.75rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    🔒 Voting locked. Requires active verified resident profile & linked wallet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    <button
                      className="btn btn-outline-danger"
                      onClick={() => handleVote(p.id, false)}
                      style={{ minHeight: "44px" }}
                    >
                      <ThumbsDown size={16} /> Reject Proof
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleVote(p.id, true)}
                      style={{ minHeight: "44px" }}
                    >
                      <ThumbsUp size={16} /> Approve Release
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default YouthDashboard;
