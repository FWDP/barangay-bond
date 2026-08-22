import React, { useState, useEffect } from "react";
import { submitMilestoneProof } from "../transactions/transactions";
import type { Project, ProjectProposal, ProjectPhase, TransactionStatus } from "../types";
import { ChevronRight, ArrowLeft, Bot, Sparkles, Plus, Trash2, Send } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { proposalRepository } from "../repositories/proposal.repository";
import { useLoading } from "../contexts/LoadingContext";
import { formatXlmWithPhp, formatXlmToPhp, fetchLiveXlmRate } from "../utils/currency";
import { aiProposalAdvisorService, type AIAdvisorResponse } from "../services/aiProposalAdvisor.service";

interface SKWorkspaceProps {
  skAddress: string;
  projects: Project[];
  onExecute: (
    actionFn: (
      onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
    ) => Promise<string>
  ) => void;
}

export const SKWorkspace: React.FC<SKWorkspaceProps> = ({
  skAddress,
  projects,
  onExecute,
}) => {
  const { profile } = useAuth();
  const { startLoading, updateLoading, stopLoading } = useLoading();

  // Active user identity status check
  const isVerified =
    profile?.role === "sk_official" &&
    (profile.status === "active" || profile.verified === true || profile.verificationStatus === "approved") &&
    !!profile.walletAddress;

  // Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [projName, setProjName] = useState("");
  const [budgetXlm, setBudgetXlm] = useState("");
  const [description, setDescription] = useState("");
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privateProofUrl, setPrivateProofUrl] = useState("");

  // AI Governance Buddy & Phase States
  const [aiResult, setAiResult] = useState<AIAdvisorResponse | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [applyAITotalBudget, setApplyAITotalBudget] = useState(true);
  const [selectedAIPhases, setSelectedAIPhases] = useState<Record<number, boolean>>({});

  // Add a new phase dynamically
  const handleAddPhase = () => {
    const total = parseFloat(budgetXlm) || 0;
    const nextNum = phases.length + 1;
    const newPhase: ProjectPhase = {
      phaseNumber: nextNum,
      title: `Phase ${nextNum}: Deliverable ${nextNum}`,
      percentage: 0,
      amountXlm: 0,
      description: "",
    };
    const updated = [...phases, newPhase];
    // Rebalance percentages equally
    const evenPct = Math.floor(100 / updated.length);
    const remainder = 100 - (evenPct * updated.length);
    updated.forEach((p, idx) => {
      p.percentage = idx === 0 ? evenPct + remainder : evenPct;
      p.amountXlm = (total * p.percentage) / 100;
    });
    setPhases(updated);
  };

  // Remove a phase dynamically
  const handleRemovePhase = (index: number) => {
    if (phases.length <= 1) return;
    const total = parseFloat(budgetXlm) || 0;
    const filtered = phases.filter((_, idx) => idx !== index);
    filtered.forEach((p, idx) => {
      p.phaseNumber = idx + 1;
    });
    // Rebalance
    const evenPct = Math.floor(100 / filtered.length);
    const remainder = 100 - (evenPct * filtered.length);
    filtered.forEach((p, idx) => {
      p.percentage = idx === 0 ? evenPct + remainder : evenPct;
      p.amountXlm = (total * p.percentage) / 100;
    });
    setPhases(filtered);
  };

  const handleAskAIBuddy = async () => {
    setIsAnalyzingAI(true);
    startLoading({
      category: "ai",
      title: "ðŸ¤– Gemini AI Governance Audit",
      message: `Auditing "${projName || "Project Proposal"}" against real-world Philippine market benchmarks...`,
      steps: [
        "Connecting to Gemini 2.5 Flash API",
        "Auditing Real-World Philippine Prices",
        "Generating Optimal Tranche Allocations",
      ],
    });

    try {
      updateLoading("Fetching real-world Philippine market prices...", 1);
      const res = await aiProposalAdvisorService.analyzeProposal(
        projName.trim(),
        description.trim(),
        parseFloat(budgetXlm) || 0,
        phases
      );
      updateLoading("Finalizing AI Governance Report...", 2);
      setAiResult(res);
      // Default all recommended phases as selected
      const initialSelected: { [key: number]: boolean } = {};
      (res.recommendedPhases || []).forEach((_, idx) => {
        initialSelected[idx] = true;
      });
      setSelectedAIPhases(initialSelected);
      setApplyAITotalBudget(true);
      setShowAIModal(true);
    } catch (err) {
      console.error("AI Buddy error:", err);
    } finally {
      setIsAnalyzingAI(false);
      stopLoading();
    }
  };

  const handleApplySelectedAIRecommendations = () => {
    if (!aiResult) return;

    // Apply AI Total Budget if selected
    if (applyAITotalBudget && aiResult.recommendedTotalXlm) {
      setBudgetXlm(aiResult.recommendedTotalXlm.toString());
    }

    const currentTotal = applyAITotalBudget && aiResult.recommendedTotalXlm
      ? aiResult.recommendedTotalXlm
      : parseFloat(budgetXlm) || 0;

    // Filter recommended phases to ONLY those checked by the user
    const chosen = (aiResult.recommendedPhases || []).filter((_, idx) => !!selectedAIPhases[idx]);

    if (chosen.length > 0) {
      // Rebalance selected phases to sum up to 100%
      const evenPct = Math.floor(100 / chosen.length);
      const remainder = 100 - (evenPct * chosen.length);
      const rebalanced = chosen.map((p, idx) => {
        const pct = idx === 0 ? evenPct + remainder : evenPct;
        return {
          ...p,
          phaseNumber: idx + 1,
          percentage: pct,
          amountXlm: (currentTotal * pct) / 100,
        };
      });
      setPhases(rebalanced);
    }

    setShowAIModal(false);
  };

  const handleAutoBalance = () => {
    const total = parseFloat(budgetXlm) || 0;
    const count = phases.length;
    if (count === 0) return;
    const updated = [...phases];
    const evenPct = Math.floor(100 / count);
    const remainder = 100 - (evenPct * count);
    updated.forEach((p, idx) => {
      p.percentage = idx === 0 ? evenPct + remainder : evenPct;
      p.amountXlm = (total * p.percentage) / 100;
    });
    setPhases(updated);
    setCreateError("");
  };

  // Proposal List State
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [selectedProjId, setSelectedProjId] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofError, setProofError] = useState("");

  // Real-time listener for proposals & live currency fetch
  useEffect(() => {
    fetchLiveXlmRate().catch(console.error);
    if (!profile?.barangayId) return;
    const unsubscribe = proposalRepository.subscribeToProposals(profile.barangayId, (data) => {
      const myProps = data.filter((p) => p.skOfficialUid === profile.uid || p.skOfficialAddress.toLowerCase() === skAddress.toLowerCase());
      setProposals(myProps);
    });
    return () => unsubscribe();
  }, [profile?.barangayId, profile?.uid, skAddress]);

  // Filter on-chain projects created by this user
  const myProjects = projects.filter((p) => {
    const isCreator = p.creator.toLowerCase() === skAddress.toLowerCase();
    const isProposer = proposals.some(
      (prop) =>
        prop.projectName.toLowerCase() === p.name.toLowerCase() &&
        prop.status === "approved_onchain"
    );
    return isCreator || isProposer;
  });

  const projectsAwaitingProof = myProjects.filter((p) => {
    if (p.status !== 0) return false;
    const currentMs = p.milestones?.find((ms) => ms.index === p.currentPhase);
    return currentMs ? currentMs.status === 0 : (p.milestone1Status === 0);
  });

  const myProposals = proposals.filter(
    (p) => p.skOfficialUid === profile?.uid
  );

  const handleNextStep = () => {
    setCreateError("");
    if (wizardStep === 1) {
      if (!projName.trim() || !description.trim()) {
        setCreateError("All project fields are required.");
        return;
      }
      setWizardStep(2);
    } else if (wizardStep === 2) {
      const budgetNum = parseFloat(budgetXlm);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        setCreateError("Escrow budget must be a positive number.");
        return;
      }
      if (phases.length === 0) {
        setCreateError("Please add at least 1 tranche phase or click 'ðŸ¤– Ask AI Buddy to Generate Tranches'.");
        return;
      }
      const sumPct = phases.reduce((acc, p) => acc + p.percentage, 0);
      if (sumPct !== 100) {
        setCreateError(`Total phase percentages must sum up to 100% (currently ${sumPct}%). Click 'âœ¨ Auto-Balance to 100%'.`);
        return;
      }
      setWizardStep(3);
    }
  };

  const handlePrevStep = () => {
    setWizardStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmitProposal = async () => {
    setCreateError("");
    setCreateSuccess("");
    const budgetNum = parseFloat(budgetXlm);

    if (!profile?.barangayId || !profile.uid) {
      setCreateError("Unable to identify active user profile. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    startLoading({
      category: "crud",
      title: "ðŸ’¾ Submitting SK Project Proposal",
      message: `Writing proposal "${projName}" and tranche schedule to Firestore...`,
      steps: [
        "Validating Proposal Parameters",
        "Writing Firestore Proposal Document",
        "Notifying Barangay Admin",
      ],
    });

    try {
      updateLoading("Writing proposal to Barangay Firestore Database...", 1);
      await proposalRepository.createProposal({
        barangayId: profile.barangayId,
        skOfficialUid: profile.uid,
        skOfficialAddress: skAddress,
        skOfficialName: profile.displayName || profile.name || "SK Official",
        projectName: projName.trim(),
        proposedBudgetXlm: budgetNum,
        proposedMobilizationPct: phases[0]?.percentage || 40,
        phases: phases,
        description: description.trim(),
      });
      updateLoading("Proposal submitted successfully!", 2);

      setCreateSuccess("Proposal submitted to Barangay Admin successfully! Awaiting review.");
      setProjName("");
      setBudgetXlm("");
      setDescription("");
      setPhases([]);
      setWizardStep(1);
    } catch (err: any) {
      console.error("Failed to submit proposal:", err);
      setCreateError(err.message || "Failed to submit project proposal.");
    } finally {
      setIsSubmitting(false);
      stopLoading();
    }
  };

  const handleUploadProof = (e: React.FormEvent) => {
    e.preventDefault();
    setProofError("");

    if (!selectedProjId) {
      setProofError("Please select a project.");
      return;
    }

    if (!proofUrl.trim() || !proofUrl.startsWith("http")) {
      setProofError("Please enter a valid HTTP/HTTPS URL for proof documentation.");
      return;
    }

    const targetProj = myProjects.find(p => p.id === Number(selectedProjId));
    const milestoneIndex = targetProj?.currentPhase || 2;

    onExecute(async (onStatusChange) => {
      try {
        const txHash = await submitMilestoneProof(
          skAddress,
          Number(selectedProjId),
          milestoneIndex,
          proofUrl.trim(),
          onStatusChange
        );

        const projId = Number(selectedProjId);
        const matchingProp = proposals.find(
          (prop) => prop.onChainProjectId === projId ||
            prop.projectName.toLowerCase() === projects.find((p) => p.id === projId)?.name.toLowerCase()
        );

        if (matchingProp && matchingProp.id) {
          if (privateProofUrl.trim()) {
            await proposalRepository.submitAdditionalProof(
              matchingProp.id,
              milestoneIndex,
              privateProofUrl.trim()
            );
          }
        }

        setProofUrl("");
        setPrivateProofUrl("");
        setSelectedProjId("");
        return txHash;
      } catch (err: any) {
        console.error("Failed to submit proof:", err);
        throw err;
      }
    });
  };

  const getProposalBadge = (status: string) => {
    if (status === "approved_onchain") {
      return <span className="badge badge-success">✓ Approved</span>;
    }
    if (status === "rejected") {
      return <span className="badge badge-danger">✕ Rejected</span>;
    }
    return <span className="badge badge-warning">⏳ Pending Review</span>;
  };

  return (
    <div className="bank-section">
      {/* SECTION HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            SK Project Proposal Studio
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem", margin: "0.2rem 0 0 0" }}>
            Apply for municipal escrow funding and submit milestone execution proofs.
          </p>
        </div>
        <span className="badge badge-role">
          Step {wizardStep} of 3
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        {/* LEFT: PROPOSAL WIZARD (BANKING APPLICATION WORKFLOW) */}
        <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="bank-card-header">
            <div>
              <h3 className="bank-card-title">New Project Proposal</h3>
              <div className="bank-card-subtitle">
                {wizardStep === 1 && "01 Basic Project Information"}
                {wizardStep === 2 && "02 Budget & Tranche Allocation"}
                {wizardStep === 3 && "03 Review & Admin Submission"}
              </div>
            </div>
          </div>

          {!isVerified ? (
            <div style={{ background: "var(--bg-elevated)", borderRadius: "14px", padding: "1.5rem", textAlign: "center", color: "var(--text-muted)" }}>
              ðŸ”’ Proposal creation is locked. Proposing project budgets requires verified SK Official status.
            </div>
          ) : (
            <>
              {createError && (
                <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "10px", padding: "0.75rem", color: "#f87171", fontSize: "0.82rem" }}>
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div style={{ background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)", borderRadius: "10px", padding: "0.75rem", color: "var(--accent-green)", fontSize: "0.82rem", fontWeight: 700 }}>
                  {createSuccess}
                </div>
              )}

              {/* STEP 1: BASIC INFO */}
              {wizardStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group">
                    <label>Project Initiative Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. WiFi Hubs & Community Tech Centers"
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Work Deliverables Scope</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Detail the scope of work. What deliverables will be completed in Phase 1 mobilization and Phase 2 execution?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  <button className="btn btn-primary w-100" onClick={handleNextStep}>
                    Continue to Budget & Tranches <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* STEP 2: BUDGET & TRANCHES */}
              {wizardStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Requested Escrow Budget (XLM)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        placeholder="e.g. 1000"
                        value={budgetXlm}
                        onChange={(e) => {
                          setBudgetXlm(e.target.value);
                          const total = parseFloat(e.target.value) || 0;
                          setPhases((prev) =>
                            prev.map((p) => ({
                              ...p,
                              amountXlm: (total * p.percentage) / 100,
                            }))
                          );
                        }}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleAskAIBuddy}
                      disabled={isAnalyzingAI}
                      style={{ minHeight: "44px", color: "var(--role-accent)", borderColor: "var(--role-accent-border)" }}
                    >
                      <Bot size={16} />
                      {isAnalyzingAI ? "Auditing..." : "AI Advisor"}
                    </button>
                  </div>

                  {budgetXlm && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      Estimated Value: <strong style={{ color: "var(--role-accent)" }}>{formatXlmToPhp(parseFloat(budgetXlm) || 0)}</strong>
                    </div>
                  )}

                  {/* Tranche Phase Cards */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                      <label style={{ margin: 0 }}>Milestone Tranches ({phases.length} Phases)</label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={handleAddPhase}
                        style={{ height: "28px", fontSize: "0.72rem" }}
                      >
                        <Plus size={12} /> Add Phase
                      </button>
                    </div>

                    {phases.length === 0 ? (
                      <div style={{ background: "var(--bg-elevated)", border: "1px dashed var(--border-primary)", borderRadius: "14px", padding: "1.5rem", textAlign: "center" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "0 0 0.75rem 0" }}>
                          No tranches configured. Click AI Advisor to generate optimal distributions.
                        </p>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleAskAIBuddy}>
                          <Sparkles size={13} /> Generate Tranches with AI
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {phases.map((ph, idx) => {
                          const total = parseFloat(budgetXlm) || 0;
                          const phaseAmt = (total * ph.percentage) / 100;
                          return (
                            <div key={ph.phaseNumber} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", padding: "0.85rem", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>Phase {ph.phaseNumber}</span>
                                {phases.length > 1 && (
                                  <button type="button" style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }} onClick={() => handleRemovePhase(idx)}>
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.6rem" }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder={`Phase ${ph.phaseNumber} Title`}
                                  value={ph.title}
                                  onChange={(e) => {
                                    const updated = [...phases];
                                    updated[idx].title = e.target.value;
                                    setPhases(updated);
                                  }}
                                  style={{ padding: "0.45rem 0.65rem", fontSize: "0.85rem" }}
                                />
                                <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                  <input
                                    type="number"
                                    className="form-control"
                                    placeholder="%"
                                    value={ph.percentage}
                                    onChange={(e) => {
                                      const newPct = parseFloat(e.target.value) || 0;
                                      const updated = [...phases];
                                      updated[idx].percentage = newPct;
                                      updated[idx].amountXlm = (total * newPct) / 100;
                                      setPhases(updated);
                                    }}
                                    style={{ padding: "0.45rem 0.65rem", fontSize: "0.85rem" }}
                                  />
                                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>%</span>
                                </div>
                              </div>

                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                                <span>Release: <strong style={{ color: "var(--role-accent)" }}>{phaseAmt.toFixed(1)} XLM</strong></span>
                                <span>{ph.percentage}% of total</span>
                              </div>
                            </div>
                          );
                        })}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.3rem" }}>
                          <span style={{ fontSize: "0.78rem", color: phases.reduce((acc, p) => acc + p.percentage, 0) === 100 ? "var(--accent-green)" : "#f87171", fontWeight: 700 }}>
                            Total: {phases.reduce((acc, p) => acc + p.percentage, 0)}% (Must equal 100%)
                          </span>
                          <button type="button" className="btn btn-sm btn-outline" onClick={handleAutoBalance} style={{ fontSize: "0.72rem" }}>
                            âœ¨ Auto-Balance
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={handlePrevStep}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleNextStep}>
                      Review Proposal
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & SUBMIT */}
              {wizardStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <h4 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{projName}</h4>
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>{description}</p>
                    
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Total Budget:</span>
                        <strong style={{ color: "var(--role-accent)" }}>{formatXlmWithPhp(budgetXlm).combined}</strong>
                      </div>
                      {phases.map((ph) => (
                        <div key={ph.phaseNumber} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                          <span>{ph.title} ({ph.percentage}%):</span>
                          <strong>{((parseFloat(budgetXlm) * ph.percentage) / 100).toFixed(1)} XLM</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={handlePrevStep} disabled={isSubmitting}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1.5 }} onClick={handleSubmitProposal} disabled={isSubmitting}>
                      {isSubmitting ? "Submitting..." : "Submit to Admin"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: SUBMITTED PROPOSALS & DELIVERABLE PROOF UPLOAD */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Milestone Deliverables Upload */}
          <div className="bank-card">
            <div className="bank-card-header">
              <div>
                <h3 className="bank-card-title">Upload Milestone Proof</h3>
                <div className="bank-card-subtitle">Submit deliverables to trigger citizen voting</div>
              </div>
            </div>

            {!isVerified ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: 0 }}>
                ðŸ”’ Proof uploads locked. Requires verified SK Official status.
              </p>
            ) : projectsAwaitingProof.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: 0 }}>
                No active on-chain projects currently awaiting milestone deliverables.
              </p>
            ) : (
              <form onSubmit={handleUploadProof} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {proofError && (
                  <div style={{ background: "var(--accent-danger-soft)", padding: "0.65rem", borderRadius: "8px", color: "#f87171", fontSize: "0.78rem" }}>
                    {proofError}
                  </div>
                )}

                <div className="form-group">
                  <label>Select Project Initiative</label>
                  <select
                    className="select-control"
                    value={selectedProjId}
                    onChange={(e) => setSelectedProjId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Project --</option>
                    {projectsAwaitingProof.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id}: {p.name} ({p.budget} XLM)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Public Deliverables URL (IPFS / Google Drive)</label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://..."
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary w-100" style={{ minHeight: "42px" }}>
                  <Send size={15} /> Submit Deliverables for Citizen Audit
                </button>
              </form>
            )}
          </div>

          {/* Submitted Proposals Tracker */}
          <div className="bank-card">
            <div className="bank-card-header">
              <div>
                <h3 className="bank-card-title">My Proposals</h3>
                <div className="bank-card-subtitle">Status of submitted grant applications</div>
              </div>
            </div>

            {myProposals.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: 0 }}>No proposals submitted yet.</p>
            ) : (
              <div className="bank-ledger-list">
                {myProposals.map((prop) => (
                  <div key={prop.id} className="bank-ledger-row">
                    <div className="bank-ledger-left">
                      <div className="bank-ledger-details">
                        <span className="bank-ledger-title">{prop.projectName}</span>
                        <span className="bank-ledger-sub">
                          {prop.proposedBudgetXlm} XLM (â‰ˆ {formatXlmToPhp(prop.proposedBudgetXlm)})
                        </span>
                      </div>
                    </div>
                    <div className="bank-ledger-right">
                      {getProposalBadge(prop.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ðŸ¤– AI GOVERNANCE REVIEW MODAL (FINANCIAL AUDIT REPORT) */}
      {showAIModal && aiResult && (
        <div className="modal-overlay" onClick={() => setShowAIModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
                  <Bot size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                    AI Governance Audit
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Financial Feasibility & Price Benchmark</span>
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowAIModal(false)}>✕</button>
            </div>

            {/* Overall Feasibility Card */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
                  Audit Verdict
                </span>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--role-accent)", marginTop: "0.1rem" }}>
                  {aiResult.verdict}
                </div>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text-primary)" }}>
                {aiResult.feasibilityScore}%
              </div>
            </div>

            {/* Recommended Tranches */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                Recommended Tranche Allocation:
              </span>
              {(aiResult.recommendedPhases || []).map((ph, idx) => {
                const isChecked = !!selectedAIPhases[idx];
                return (
                  <div key={idx} style={{ background: isChecked ? "var(--bg-hover)" : "var(--bg-elevated)", border: `1px solid ${isChecked ? "var(--role-accent-border)" : "var(--border-primary)"}`, borderRadius: "12px", padding: "0.75rem 0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setSelectedAIPhases((prev) => ({ ...prev, [idx]: e.target.checked }))}
                      />
                      <span>{ph.title} ({ph.percentage}%)</span>
                    </label>
                    <strong style={{ color: "var(--role-accent)", fontSize: "0.85rem" }}>
                      {(((parseFloat(budgetXlm) || 0) * ph.percentage) / 100).toFixed(1)} XLM
                    </strong>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAIModal(false)}>
                Keep Draft
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1.5 }} onClick={handleApplySelectedAIRecommendations}>
                <Sparkles size={14} /> Apply Recommended Tranches
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SKWorkspace;
