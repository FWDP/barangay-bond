import React, { useState, useEffect, useMemo } from "react";
import { voteMilestone } from "../transactions/transactions";
import type { Project, TransactionStatus, ProjectProposal } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { proposalRepository } from "../repositories/proposal.repository";
import {
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  Lock,
  Eye,
  MapPin,
  Building,
  Layers,
  X
} from "lucide-react";
import { formatXlmWithPhp } from "../utils/currency";
import { ImageCarousel } from "./ImageCarousel";
import { createPortal } from "react-dom";

interface YouthDashboardProps {
  voterAddress: string;
  projects: Project[];
  isGuest?: boolean;
  onExecute: (
    actionFn: (
      onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
    ) => Promise<string>
  ) => void;
  onNavigateAuth?: () => void;
}

export const YouthDashboard: React.FC<YouthDashboardProps> = ({
  voterAddress,
  projects,
  isGuest = false,
  onExecute,
  onNavigateAuth,
}) => {
  const { profile, getApprovedBarangays } = useAuth();
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [barangayList, setBarangayList] = useState<any[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "voting" | "execution" | "pipeline" | "completed">("all");

  // Selected project for full-screen governance & voting modal
  const [selectedProjectForModal, setSelectedProjectForModal] = useState<{
    project: Project;
    matchingProp?: ProjectProposal;
  } | null>(null);

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

  // Subscribe to ALL proposals nationwide for cross-barangay discovery & search
  useEffect(() => {
    const unsubscribe = proposalRepository.subscribeToAllProposals((data) => {
      setProposals(data);
    });
    return () => unsubscribe();
  }, []);

  // Fetch approved barangays for dropdown selector
  useEffect(() => {
    getApprovedBarangays()
      .then((list) => setBarangayList(list))
      .catch(console.error);
  }, [getApprovedBarangays]);

  // Helper to resolve proposal details for an on-chain project
  const getMatchingProposal = (p: Project): ProjectProposal | undefined => {
    return proposals.find(
      (pr) =>
        pr.onChainProjectId === p.id ||
        pr.projectName.toLowerCase() === p.name.toLowerCase()
    );
  };

  // Helper to extract Barangay Label
  const getProjectBarangayName = (p: Project): string => {
    const prop = getMatchingProposal(p);
    if (prop?.barangayName) return prop.barangayName;
    if (prop?.barangayId) {
      const found = barangayList.find((b) => b.id === prop.barangayId);
      if (found) return found.name;
      return prop.barangayId;
    }
    return "Civic Vault";
  };

  // Filter projects by Search Query & Selected Barangay
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const prop = getMatchingProposal(p);
      const bgyId = prop?.barangayId || "";

      // 1. Barangay Filter
      if (selectedBarangayId !== "all" && bgyId !== selectedBarangayId) {
        return false;
      }

      // 2. Keyword Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const bgyName = getProjectBarangayName(p).toLowerCase();
        const matches =
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.creator.toLowerCase().includes(query) ||
          bgyName.includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [projects, proposals, selectedBarangayId, searchQuery, barangayList]);

  // Filter Proposals Pipeline (Awaiting Admin approval)
  const filteredProposalsPipeline = useMemo(() => {
    return proposals.filter((pr) => {
      if (pr.status !== "pending_admin_approval") return false;
      if (selectedBarangayId !== "all" && pr.barangayId !== selectedBarangayId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          pr.projectName.toLowerCase().includes(query) ||
          pr.description.toLowerCase().includes(query) ||
          (pr.barangayName && pr.barangayName.toLowerCase().includes(query));
        if (!matches) return false;
      }
      return true;
    });
  }, [proposals, selectedBarangayId, searchQuery]);

  // Tier Subsets
  const projectsAwaitingVotes = filteredProjects.filter((p) => {
    if (p.status !== 0) return false;
    const currentMs = p.milestones?.find((ms) => ms.index === p.currentPhase);
    return currentMs ? currentMs.status === 1 : p.milestone1Status === 1;
  });

  const projectsInExecution = filteredProjects.filter((p) => {
    if (p.status !== 0) return false;
    return !projectsAwaitingVotes.some((v) => v.id === p.id);
  });

  const projectsCompleted = filteredProjects.filter((p) => p.status === 1 || p.status === 2);

  // Age calculation for resident voter verification
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

  const age = getAge(profile?.birthdate);
  const isOveragedOrUnderaged = profile?.role === "resident" && (age < 15 || age > 30);
  const isVerifiedResident =
    !isGuest &&
    profile?.role === "resident" &&
    profile.verified === true &&
    (profile.status === "active" || profile.verificationStatus === "approved") &&
    !isOveragedOrUnderaged;

  // Check if a project is in the user's registered Barangay jurisdiction
  const checkIsMyBarangay = (p: Project): boolean => {
    if (isGuest || !profile?.barangayId) return false;
    const prop = getMatchingProposal(p);
    if (!prop) return true;
    return prop.barangayId === profile.barangayId;
  };

  const handleVote = (projectId: number, approve: boolean) => {
    const p = projects.find((proj) => proj.id === projectId);
    if (!p) return;
    const milestoneIndex = p.currentPhase || 2;

    onExecute(async (onStatusChange) => {
      try {
        const targetVoterAddress = profile?.walletAddress || voterAddress;
        console.log(`[VOTING_DEBUG] 🗳️ Initiating vote for Project #${projectId}, Milestone #${milestoneIndex}, approve=${approve}`);
        const txHash = await voteMilestone(
          targetVoterAddress,
          projectId,
          milestoneIndex,
          approve,
          onStatusChange,
          profile?.inAppWalletSecret || undefined
        );
        console.log(`[VOTING_DEBUG] ✅ Vote transaction committed on-chain. TxHash: ${txHash}`);

        setVotedProjects((prev) => ({ ...prev, [projectId]: true }));
        try {
          localStorage.setItem(`voted_proj_${projectId}_${milestoneIndex}_${targetVoterAddress}`, "true");
        } catch (e) {
          console.error(e);
        }
        return txHash;
      } catch (err: any) {
        console.error("[VOTING_DEBUG] ❌ Failed to vote:", err);
        throw err;
      }
    });
  };

  return (
    <div className="bank-section" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* SECTION HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            {isGuest ? "Browse Community Projects" : "Community Projects"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.2rem 0 0 0" }}>
            {isGuest
              ? "View and search all active barangay projects across the Philippines."
              : "Explore and vote on projects in your barangay."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!isGuest && (
            <span className="badge badge-role">
              Needs 60% votes to approve
            </span>
          )}
          <span className="badge badge-info">
            {filteredProjects.length} projects
          </span>
        </div>
      </div>

      {/* GUEST OR AUDITOR ADVISORY BANNER */}
      {isGuest ? (
        <div className="section-card" style={{ borderLeft: "3px solid var(--accent-blue)", padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Eye size={17} style={{ color: "var(--accent-blue)" }} />
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                <strong>Viewing as guest.</strong> You can browse all projects but cannot vote.
              </div>
            </div>
            {onNavigateAuth && (
              <button className="btn btn-sm btn-primary tap-scale" onClick={onNavigateAuth} style={{ fontWeight: 800 }}>
                Sign In
              </button>
            )}
          </div>
        </div>
      ) : isOveragedOrUnderaged ? (
        <div className="section-card" style={{ borderLeft: "3px solid #ef4444", padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Lock size={17} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              <strong>Public Auditor Mode (Age Restriction):</strong> Voting is restricted to Katipunan ng Kabataan members (ages 15–30) per Republic Act 10742. You can view all projects and audit milestones as a public auditor.
            </div>
          </div>
        </div>
      ) : null}

      {/* SEARCH, JURISDICTION FILTER & STATUS TABS */}
      <div className="bank-card" style={{ padding: "1.1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
            />
            <input
              type="text"
              className="fintech-input"
              placeholder="Search initiatives, scope, contractor wallet, or barangay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "2.3rem", width: "100%", height: "38px" }}
            />
          </div>

          <div style={{ minWidth: "200px" }}>
            <select
              className="fintech-input"
              value={selectedBarangayId}
              onChange={(e) => setSelectedBarangayId(e.target.value)}
              style={{ height: "38px", width: "100%", fontWeight: 600 }}
            >
              <option value="all">🏛️ All Barangays (Nationwide)</option>
              {barangayList.map((b) => (
                <option key={b.id} value={b.id}>
                  Brgy. {b.name} ({b.city || "NCR"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
          {[
            { id: "all", label: `All Initiatives (${filteredProjects.length})` },
            { id: "voting", label: `🗳️ Active Votes (${projectsAwaitingVotes.length})` },
            { id: "execution", label: `⚡ In Execution (${projectsInExecution.length})` },
            { id: "pipeline", label: `📋 Proposals Pipeline (${filteredProposalsPipeline.length})` },
            { id: "completed", label: `✅ Completed (${projectsCompleted.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`btn btn-sm ${activeTab === tab.id ? "btn-primary" : "btn-outline"} tap-scale`}
              onClick={() => setActiveTab(tab.id as any)}
              style={{ fontSize: "0.75rem", height: "32px", borderRadius: "9999px", padding: "0 0.85rem", fontWeight: 700 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          TIER 1: ACTIVE MILESTONE VOTING & FEASIBILITY POLLS (COMPACT GRID)
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "voting") && projectsAwaitingVotes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="badge badge-warning" style={{ fontSize: "0.74rem", fontWeight: 800 }}>Action Required</span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Active Milestone Votes ({projectsAwaitingVotes.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
            {projectsAwaitingVotes.map((p) => {
              const currentMs = p.milestones?.find((ms) => ms.index === p.currentPhase);
              const matchingProp = getMatchingProposal(p);
              const bgyName = getProjectBarangayName(p);
              const isFeasibilityReview = matchingProp?.phase1Policy === "feasibility_vote" && (p.currentPhase === 1 || !p.currentPhase);
              const currencyObj = formatXlmWithPhp(p.budget);
              const approveCount = currentMs?.votesApprove ?? p.milestone1VotesApprove ?? 0;
              const rejectCount = currentMs?.votesReject ?? p.milestone1VotesReject ?? 0;

              return (
                <div key={p.id} className="bank-card tap-scale" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.9rem" }}>
                  {/* Thumbnail Carousel */}
                  <ImageCarousel
                    images={matchingProp?.imageUrls || []}
                    alt={p.name}
                    height="140px"
                    rounded="10px"
                    showLightboxOnClick={false}
                  />

                  {/* Header & Badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.4rem" }}>
                    <div>
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase" }}>
                        Project #{p.id} • Brgy. {bgyName}
                      </span>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.15rem 0 0 0", lineClamp: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.name}
                      </h4>
                    </div>
                    <span className={`badge ${isFeasibilityReview ? "badge-info" : "badge-warning"}`} style={{ fontSize: "0.65rem", flexShrink: 0 }}>
                      {isFeasibilityReview ? "Feasibility" : "Voting"}
                    </span>
                  </div>

                  {/* Proposer Info */}
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                    <span>Proposed by:</span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {matchingProp?.skOfficialName ? `Hon. ${matchingProp.skOfficialName}` : "SK Official"}
                    </strong>
                    <span className="badge badge-role" style={{ fontSize: "0.62rem", padding: "0.08rem 0.4rem" }}>
                      SK Council
                    </span>
                  </div>

                  {/* Budget & Quorum Quick Summary */}
                  <div style={{ background: "var(--bg-elevated)", padding: "0.55rem 0.75rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Budget</span>
                      <strong style={{ fontSize: "0.88rem", color: "var(--role-accent)" }}>{currencyObj.phpStr}</strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>Consensus</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-green)" }}>
                        {approveCount} 👍 / {rejectCount} 👎
                      </span>
                    </div>
                  </div>

                  {/* View Details & Vote CTA Button */}
                  <button
                    type="button"
                    className="btn btn-primary tap-scale"
                    style={{ width: "100%", marginTop: "auto", fontWeight: 800, fontSize: "0.78rem", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                    onClick={() => setSelectedProjectForModal({ project: p, matchingProp })}
                  >
                    <Eye size={13} /> View Full Scope & Vote
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 2: PROJECTS IN ACTIVE EXECUTION (COMPACT GRID)
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "execution") && projectsInExecution.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="badge badge-info" style={{ fontSize: "0.74rem", fontWeight: 800 }}>In Progress</span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Community Projects in Active Execution ({projectsInExecution.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
            {projectsInExecution.map((p) => {
              const currencyObj = formatXlmWithPhp(p.budget);
              const bgyName = getProjectBarangayName(p);
              const matchingProp = getMatchingProposal(p);

              return (
                <div key={p.id} className="bank-card tap-scale" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.9rem" }}>
                  <ImageCarousel
                    images={matchingProp?.imageUrls || []}
                    alt={p.name}
                    height="140px"
                    rounded="10px"
                    showLightboxOnClick={false}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.4rem" }}>
                    <div>
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase" }}>
                        Project #{p.id} • Brgy. {bgyName}
                      </span>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.15rem 0 0 0", lineClamp: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.name}
                      </h4>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: "0.65rem", flexShrink: 0 }}>
                      Phase {p.currentPhase}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                    <span>Proposed by:</span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {matchingProp?.skOfficialName ? `Hon. ${matchingProp.skOfficialName}` : "SK Official"}
                    </strong>
                    <span className="badge badge-role" style={{ fontSize: "0.62rem", padding: "0.08rem 0.4rem" }}>
                      SK Council
                    </span>
                  </div>

                  <div style={{ background: "var(--bg-elevated)", padding: "0.55rem 0.75rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Escrow Budget</span>
                    <strong style={{ fontSize: "0.88rem", color: "var(--role-accent)" }}>{currencyObj.phpStr}</strong>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline tap-scale"
                    style={{ width: "100%", marginTop: "auto", fontWeight: 700, fontSize: "0.78rem", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                    onClick={() => setSelectedProjectForModal({ project: p, matchingProp })}
                  >
                    <Eye size={13} /> View Milestones & Deliverables
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 3: PROPOSED INITIATIVES PIPELINE (COMPACT GRID)
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "pipeline") && filteredProposalsPipeline.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="badge badge-role" style={{ fontSize: "0.74rem", fontWeight: 800 }}>Pipeline</span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Proposed Initiatives Pipeline ({filteredProposalsPipeline.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
            {filteredProposalsPipeline.map((pr) => {
              const estPhp = formatXlmWithPhp(pr.proposedBudgetXlm);
              return (
                <div key={pr.id} className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.9rem", opacity: 0.95 }}>
                  <ImageCarousel
                    images={pr.imageUrls || []}
                    alt={pr.projectName}
                    height="140px"
                    rounded="10px"
                    showLightboxOnClick={false}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>
                        Brgy. {pr.barangayName || pr.barangayId}
                      </span>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.15rem 0 0 0" }}>
                        {pr.projectName}
                      </h4>
                    </div>
                    <span className="badge badge-role" style={{ fontSize: "0.65rem" }}>
                      Review
                    </span>
                  </div>

                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                    <span>Proposed by:</span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {pr.skOfficialName ? `Hon. ${pr.skOfficialName}` : "SK Official"}
                    </strong>
                    <span className="badge badge-role" style={{ fontSize: "0.62rem", padding: "0.08rem 0.4rem" }}>
                      SK Council
                    </span>
                  </div>

                  <div style={{ marginTop: "auto", background: "var(--bg-elevated)", padding: "0.55rem 0.75rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Requested Budget</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--role-accent)" }}>{estPhp.phpStr}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 4: COMPLETED INITIATIVES ARCHIVE (COMPACT GRID)
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "completed") && projectsCompleted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="badge badge-success" style={{ fontSize: "0.74rem", fontWeight: 800 }}>✓ Completed Archive</span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Completed & Delivered Initiatives ({projectsCompleted.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
            {projectsCompleted.map((p) => {
              const currencyObj = formatXlmWithPhp(p.budget);
              const bgyName = getProjectBarangayName(p);
              const matchingProp = getMatchingProposal(p);

              return (
                <div key={p.id} className="bank-card tap-scale" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.9rem" }}>
                  <ImageCarousel
                    images={matchingProp?.imageUrls || []}
                    alt={p.name}
                    height="140px"
                    rounded="10px"
                    showLightboxOnClick={false}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.4rem" }}>
                    <div>
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--accent-green)", textTransform: "uppercase" }}>
                        Project #{p.id} • Brgy. {bgyName}
                      </span>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.15rem 0 0 0", lineClamp: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.name}
                      </h4>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: "0.65rem", flexShrink: 0 }}>
                      ✓ Delivered
                    </span>
                  </div>

                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                    <span>Proposed by:</span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {matchingProp?.skOfficialName ? `Hon. ${matchingProp.skOfficialName}` : "SK Official"}
                    </strong>
                    <span className="badge badge-role" style={{ fontSize: "0.62rem", padding: "0.08rem 0.4rem" }}>
                      SK Council
                    </span>
                  </div>

                  <div style={{ background: "var(--bg-elevated)", padding: "0.55rem 0.75rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Total Disbursed</span>
                    <strong style={{ fontSize: "0.88rem", color: "var(--accent-green)" }}>{currencyObj.phpStr}</strong>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline tap-scale"
                    style={{ width: "100%", marginTop: "auto", fontWeight: 700, fontSize: "0.78rem", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                    onClick={() => setSelectedProjectForModal({ project: p, matchingProp })}
                  >
                    <Eye size={13} /> View Completed Record
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {filteredProjects.length === 0 && filteredProposalsPipeline.length === 0 && (
        <div className="bank-card" style={{ padding: "3rem 1.5rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <Building size={40} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
          <h4 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
            No Initiatives Found
          </h4>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "420px" }}>
            No projects match the selected Barangay or search query. Try choosing "All Barangays" or clearing your search term.
          </p>
          {(searchQuery || selectedBarangayId !== "all") && (
            <button
              className="btn btn-sm btn-outline tap-scale"
              onClick={() => {
                setSearchQuery("");
                setSelectedBarangayId("all");
                setActiveTab("all");
              }}
              style={{ marginTop: "0.5rem", fontWeight: 700 }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          DEDICATED FULL PROJECT GOVERNANCE & VOTING MODAL
          ========================================================================= */}
      {selectedProjectForModal && (() => {
        const p = selectedProjectForModal.project;
        const matchingProp = selectedProjectForModal.matchingProp;
        const bgyName = getProjectBarangayName(p);
        const isMyBarangay = checkIsMyBarangay(p);
        const hasVoted = !!votedProjects[p.id];
        const currentMs = p.milestones?.find((ms) => ms.index === p.currentPhase);
        const isFeasibilityReview = matchingProp?.phase1Policy === "feasibility_vote" && (p.currentPhase === 1 || !p.currentPhase);
        const isVotingActiveOnChain = isFeasibilityReview ? (p.milestone1Status === 1) : (currentMs ? currentMs.status === 1 : p.milestone1Status === 1);
        const currencyObj = formatXlmWithPhp(p.budget);

        const approveCount = currentMs?.votesApprove ?? p.milestone1VotesApprove ?? 0;
        const rejectCount = currentMs?.votesReject ?? p.milestone1VotesReject ?? 0;
        const totalVotes = approveCount + rejectCount;
        const quorumTarget = 1;

        // Extract Public Citizen Proofs Only (Hide Admin Invoices)
        const publicProofs: string[] = [];
        if (currentMs?.publicProofUrls && currentMs.publicProofUrls.length > 0) {
          publicProofs.push(...currentMs.publicProofUrls);
        } else if (matchingProp?.publicProofUrls && matchingProp.publicProofUrls[p.currentPhase || 1]) {
          publicProofs.push(...matchingProp.publicProofUrls[p.currentPhase || 1]);
        } else if (currentMs?.proofUrl) {
          publicProofs.push(currentMs.proofUrl);
        }

        const votingPhaseNum = isFeasibilityReview ? 1 : Math.max(1, p.currentPhase || 1);
        const proofPhaseNum = Math.max(1, votingPhaseNum - 1);

        return createPortal(
          <div className="modal-overlay" onClick={() => setSelectedProjectForModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "750px", maxHeight: "90vh", overflowY: "auto" }}>
              <div className="bottom-sheet-handle" />

              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase" }}>
                      Project Escrow #{p.id}
                    </span>
                    <span style={{ opacity: 0.4 }}>•</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <MapPin size={11} /> Brgy. {bgyName}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-primary)", margin: "0.2rem 0 0 0" }}>
                    {p.name}
                  </h3>

                  {/* Proposer Info */}
                  <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span>Proposed by:</span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {matchingProp?.skOfficialName ? `Hon. ${matchingProp.skOfficialName}` : "SK Official"}
                    </strong>
                    <span className="badge badge-role" style={{ fontSize: "0.68rem" }}>SK Council</span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${p.creator}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                      title="Stellar Explorer"
                    >
                      <ExternalLink size={10} /> Explorer
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setSelectedProjectForModal(null)}
                  style={{ borderRadius: "50%", width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Slidable Cover Image Carousel */}
              <div style={{ marginBottom: "1rem" }}>
                <ImageCarousel
                  images={matchingProp?.imageUrls || []}
                  alt={p.name}
                  height="220px"
                  rounded="12px"
                  showLightboxOnClick={true}
                />
              </div>

              {/* Budget Overview Card */}
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "0.9rem 1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
                    {isFeasibilityReview ? "Phase 1 Mobilization Feasibility" : `Phase ${votingPhaseNum} Milestone Release`}
                  </span>
                  <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--role-accent)", marginTop: "0.1rem" }}>
                    {currencyObj.phpStr}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>Escrow Locked</span>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {currencyObj.xlmStr}
                  </div>
                </div>
              </div>

              {/* Scope & Description */}
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.85rem 1rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 800, color: "var(--role-accent)", display: "block", marginBottom: "0.25rem" }}>
                  Project Scope & Purpose
                </span>
                <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  {p.description}
                </p>
              </div>

              {/* 100% Custom SK Milestone Phase Roadmap */}
              {matchingProp?.phases && matchingProp.phases.length > 0 && (
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", color: "var(--role-accent)", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Layers size={13} /> Milestone Roadmap ({matchingProp.phases.length} SK Phases)
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Current: Phase {votingPhaseNum}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {matchingProp.phases.map((ph, phIdx) => {
                      const phaseNum = ph.phaseNumber || (phIdx + 1);
                      const isDone = (p.currentPhase || 1) > phaseNum || p.status === 1;
                      const isCurrent = (p.currentPhase || 1) === phaseNum && p.status === 0;
                      const isLocked = (p.currentPhase || 1) < phaseNum;

                      return (
                        <div
                          key={phIdx}
                          style={{
                            background: isDone
                              ? "var(--bg-base)"
                              : isCurrent
                              ? "rgba(99, 102, 241, 0.08)"
                              : "var(--bg-surface)",
                            border: isCurrent
                              ? "1.5px solid #6366f1"
                              : isDone
                              ? "1px solid var(--border-subtle)"
                              : "1px dashed var(--border-subtle)",
                            boxShadow: isCurrent ? "0 0 16px rgba(99, 102, 241, 0.2)" : "none",
                            borderRadius: "12px",
                            padding: isCurrent ? "0.85rem 1rem" : "0.55rem 0.75rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.3rem",
                            opacity: isDone ? 0.65 : isLocked ? 0.6 : 1,
                            transition: "all 0.3s ease",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{
                              fontSize: isCurrent ? "0.88rem" : "0.78rem",
                              fontWeight: isCurrent ? 900 : 700,
                              color: isDone ? "var(--text-muted)" : isCurrent ? "var(--text-primary)" : "var(--text-secondary)"
                            }}>
                              {isDone ? "✓" : isCurrent ? "⚡" : "🔒"}{" "}
                              {ph.title.toLowerCase().startsWith(`phase ${phaseNum}:`) ||
                              ph.title.toLowerCase().startsWith(`phase ${phaseNum} -`) ||
                              ph.title.toLowerCase().startsWith(`phase ${phaseNum} `)
                                ? ph.title
                                : `Phase ${phaseNum}: ${ph.title}`}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>
                                {ph.percentage}% ({((parseFloat(p.budget?.toString() || "0") * ph.percentage) / 100).toFixed(1)} XLM)
                              </span>
                              {isDone && <span className="badge badge-secondary" style={{ fontSize: "0.65rem", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>✓ Disbursed</span>}
                              {isCurrent && isVotingActiveOnChain && <span className="badge badge-warning" style={{ fontSize: "0.68rem", fontWeight: 800 }}>🗳️ VOTING OPEN</span>}
                              {isCurrent && !isVotingActiveOnChain && <span className="badge badge-info" style={{ fontSize: "0.68rem", fontWeight: 800 }}>⚡ IN PROGRESS</span>}
                              {isLocked && <span className="badge badge-secondary" style={{ fontSize: "0.65rem" }}>🔒 Escrow Locked</span>}
                            </div>
                          </div>

                          {ph.targetDate && (
                            <div style={{ fontSize: "0.72rem", color: isCurrent ? "var(--role-accent)" : "var(--text-muted)", fontWeight: 700 }}>
                              📅 Target Milestone Date: {ph.targetDate}
                            </div>
                          )}

                          {ph.description && (
                            <p style={{ margin: 0, fontSize: isCurrent ? "0.8rem" : "0.72rem", color: isDone ? "var(--text-muted)" : "var(--text-secondary)", lineHeight: 1.35 }}>
                              {ph.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feasibility Review Auto-Evidence Banner OR Citizen Proof Gallery */}
              {isFeasibilityReview ? (
                <div style={{ background: "rgba(0, 125, 254, 0.08)", border: "1.5px solid rgba(0, 125, 254, 0.25)", borderRadius: "14px", padding: "0.9rem 1.1rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                    <Sparkles size={16} style={{ color: "#007dfe" }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 900, color: "#007dfe", textTransform: "uppercase" }}>
                      ⚡ Public Feasibility Review (Phase 1 Mobilization Escrow)
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    This initiative was designated for public community feasibility consensus. The initiative scope, description, and budget allocation above serve as the auto-submitted feasibility evidence. Verified youth residents can cast their votes below to authorize Phase 1 mobilization funds.
                  </p>
                </div>
              ) : publicProofs.length > 0 ? (
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "0.9rem 1.1rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--text-primary)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      📸 Citizen Field Turnover Proofs for Phase {proofPhaseNum} ({publicProofs.length})
                    </span>
                    <span className="badge badge-success" style={{ fontSize: "0.68rem" }}>Evidence Submitted</span>
                  </div>
                  <ImageCarousel
                    images={publicProofs}
                    alt="Milestone Deliverable Proof"
                    height="180px"
                    rounded="10px"
                    showLightboxOnClick={true}
                  />
                </div>
              ) : null}

              {/* Quorum Meter (Shown when voting is active on-chain) */}
              {p.status === 0 && isVotingActiveOnChain && (
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                    <span style={{ fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Sparkles size={14} style={{ color: "var(--accent-yellow)" }} /> Community Quorum Consensus
                    </span>
                    <span className="badge badge-info" style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}>
                      Target: {quorumTarget} Vote to Finalize
                    </span>
                  </div>

                  <div style={{ width: "100%", height: "12px", background: "var(--bg-base)", borderRadius: "6px", overflow: "hidden", display: "flex", border: "1px solid var(--border-subtle)" }}>
                    <div
                      style={{
                        width: `${totalVotes > 0 ? (approveCount / totalVotes) * 100 : approveCount > 0 ? 100 : 0}%`,
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: approveCount > 0 ? "0 0 8px rgba(16, 185, 129, 0.6)" : "none",
                      }}
                    />
                    <div
                      style={{
                        width: `${totalVotes > 0 ? (rejectCount / totalVotes) * 100 : rejectCount > 0 ? 100 : 0}%`,
                        background: "linear-gradient(90deg, #ef4444, #dc2626)",
                        transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: rejectCount > 0 ? "0 0 8px rgba(239, 68, 68, 0.6)" : "none",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--accent-green)", fontWeight: 700 }}>
                      <CheckCircle2 size={13} /> {approveCount} Approvals ({totalVotes > 0 ? Math.round((approveCount / totalVotes) * 100) : approveCount > 0 ? 100 : 0}%)
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#ef4444", fontWeight: 700 }}>
                      <XCircle size={13} /> {rejectCount} Rejections ({totalVotes > 0 ? Math.round((rejectCount / totalVotes) * 100) : rejectCount > 0 ? 100 : 0}%)
                    </div>
                  </div>
                </div>
              )}

              {/* Voting Action Buttons / Proof-Gated State inside Modal */}
              {p.status === 0 && (
                <div style={{ display: "flex", gap: "0.75rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
                  {!isVotingActiveOnChain ? (
                    <div style={{ width: "100%", background: "rgba(99, 102, 241, 0.08)", border: "1.5px solid rgba(99, 102, 241, 0.25)", borderRadius: "14px", padding: "0.95rem 1.15rem", display: "flex", alignItems: "flex-start", gap: "0.7rem" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                        <Lock size={18} style={{ color: "var(--role-accent)" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          🔒 Phase {votingPhaseNum} Voting Locked (Awaiting Phase {proofPhaseNum} Proof)
                        </span>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                          Phase {proofPhaseNum} mobilization funds have been released and the SK Council is currently conducting project activities. Once the SK Official submits the Phase {proofPhaseNum} completion evidence (photos and receipts), community quorum voting will automatically open for verified residents to inspect deliverables and release Phase {votingPhaseNum} escrow funds.
                        </p>
                      </div>
                    </div>
                  ) : isGuest ? (
                    <div style={{ width: "100%", background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--accent-blue)", fontWeight: 600 }}>
                        👁️ <strong>Public Auditor Mode:</strong> Sign in with a verified account to cast votes.
                      </span>
                      {onNavigateAuth && (
                        <button className="btn btn-sm btn-primary tap-scale" onClick={onNavigateAuth} style={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Sign In
                        </button>
                      )}
                    </div>
                  ) : profile?.role === "sk_official" ? (
                    <div style={{ width: "100%", background: "rgba(245, 158, 11, 0.08)", border: "1.5px solid rgba(245, 158, 11, 0.28)", borderRadius: "12px", padding: "0.8rem 1rem", display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                      <ShieldAlert size={17} style={{ color: "#d97706", flexShrink: 0, marginTop: "2px" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#d97706", textTransform: "uppercase" }}>
                          SK Implementer Observer Mode (RA 10742)
                        </span>
                        <p style={{ margin: 0, fontSize: "0.74rem", color: "#92400e", lineHeight: 1.35 }}>
                          SK Officials cannot vote on project deliverables due to anti-graft and conflict-of-interest regulations.
                        </p>
                      </div>
                    </div>
                  ) : profile?.role === "barangay_admin" ? (
                    <div style={{ width: "100%", background: "rgba(59, 130, 246, 0.08)", border: "1.5px solid rgba(59, 130, 246, 0.28)", borderRadius: "12px", padding: "0.8rem 1rem", display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                      <Building size={17} style={{ color: "var(--accent-blue)", flexShrink: 0, marginTop: "2px" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--accent-blue)", textTransform: "uppercase" }}>
                          Barangay Governance Oversight Mode
                        </span>
                        <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                          Barangay Administrators act as neutral escrow custodians.
                        </p>
                      </div>
                    </div>
                  ) : !isMyBarangay ? (
                    <div style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Lock size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        <strong>Auditing Only:</strong> Voting is restricted to verified youth residents of <strong>Brgy. {bgyName}</strong>.
                      </span>
                    </div>
                  ) : isOveragedOrUnderaged ? (
                    <div style={{ width: "100%", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Lock size={15} style={{ color: "#ef4444", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.78rem", color: "#ef4444" }}>
                        <strong>Age Restriction (RA 10742):</strong> Only Katipunan ng Kabataan youth residents (ages 15–30) are authorized to vote.
                      </span>
                    </div>
                  ) : !isVerifiedResident ? (
                    <div style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <ShieldCheck size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        <strong>Verification Required:</strong> Your account is pending barangay residency verification.
                      </span>
                    </div>
                  ) : hasVoted ? (
                    <div style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", color: "var(--accent-green)", fontWeight: 700, fontSize: "0.82rem" }}>
                      <CheckCircle2 size={16} /> Vote Recorded on Ledger
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "0.75rem", width: "100%" }}>
                      <button
                        type="button"
                        className="btn tap-scale"
                        style={{
                          height: "48px",
                          fontWeight: 800,
                          fontSize: "0.84rem",
                          borderRadius: "14px",
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1.5px solid rgba(239, 68, 68, 0.35)",
                          color: "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.45rem",
                          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: "0 2px 8px rgba(239, 68, 68, 0.12)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#ef4444";
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.boxShadow = "0 0 16px rgba(239, 68, 68, 0.4)";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                          e.currentTarget.style.color = "#ef4444";
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(239, 68, 68, 0.12)";
                          e.currentTarget.style.transform = "none";
                        }}
                        onClick={() => {
                          handleVote(p.id, false);
                          setSelectedProjectForModal(null);
                        }}
                      >
                        <XCircle size={18} />
                        <span>Reject Proof</span>
                      </button>

                      <button
                        type="button"
                        className="btn tap-scale"
                        style={{
                          height: "48px",
                          fontWeight: 900,
                          fontSize: "0.86rem",
                          borderRadius: "14px",
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          border: "1px solid rgba(16, 185, 129, 0.6)",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = "0 0 24px rgba(16, 185, 129, 0.6)";
                          e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.35)";
                          e.currentTarget.style.transform = "none";
                        }}
                        onClick={() => {
                          handleVote(p.id, true);
                          setSelectedProjectForModal(null);
                        }}
                      >
                        <CheckCircle2 size={19} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }} />
                        <span>{isFeasibilityReview ? "Approve Phase 1 Mobilization" : `Approve Phase ${votingPhaseNum} Release`}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default YouthDashboard;
