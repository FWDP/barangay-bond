import React, { useState } from "react";
import type { ProjectProposal, ProjectPhase } from "../types";
import { formatXlmWithPhp } from "../utils/currency";
import {
  GitCompare,
  ArrowRight,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface RevisionDiffModalProps {
  proposal: ProjectProposal;
  onClose: () => void;
}

export const RevisionDiffModal: React.FC<RevisionDiffModalProps> = ({ proposal, onClose }) => {
  const [activeTab, setActiveTab] = useState<"side_by_side" | "timeline">("side_by_side");

  const history = proposal.revisionHistory || [];
  const latestRevision = history[history.length - 1];

  // Compare original / previous vs current
  const oldBudget = latestRevision?.budgetXlm ?? proposal.proposedBudgetXlm;
  const currentBudget = proposal.approvedBudgetXlm || proposal.proposedBudgetXlm;
  const budgetDiff = currentBudget - oldBudget;

  const oldPhases: ProjectPhase[] = latestRevision?.phases || [];
  const currentPhases: ProjectPhase[] = proposal.phases || [];

  const oldCurrency = formatXlmWithPhp(oldBudget);
  const currentCurrency = formatXlmWithPhp(currentBudget);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "880px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.12)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GitCompare size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Proposal Revision Diff & Changelog
              </h3>
              <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>
                Initiative: <strong>{proposal.projectName}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ display: "flex", background: "var(--bg-elevated)", padding: "0.2rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "side_by_side" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}
                onClick={() => setActiveTab("side_by_side")}
              >
                Side-by-Side Diff
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === "timeline" ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}
                onClick={() => setActiveTab("timeline")}
              >
                History ({history.length})
              </button>
            </div>
            <button type="button" className="btn btn-sm btn-outline" onClick={onClose} style={{ padding: "0.25rem 0.6rem" }}>✕</button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {activeTab === "side_by_side" ? (
            <>
              {/* Last Edited By Banner */}
              <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "12px", padding: "0.75rem 1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.15)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Layers size={16} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.68rem", textTransform: "uppercase", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.05em", display: "block" }}>
                      Last Proposal Revision Authority
                    </span>
                    <strong style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>
                      {proposal.lastEditedByName || latestRevision?.authorName || proposal.skOfficialName || "Official"} ({proposal.lastEditedByRole || (latestRevision?.author === "admin" ? "Barangay Admin" : "SK Proposer")})
                    </strong>
                  </div>
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Clock size={13} />
                  <span>
                    {new Date(proposal.lastEditedAt || latestRevision?.timestamp || proposal.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
              </div>

              {/* Top Budget Delta Summary Banner */}
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <span style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                    Budget Comparison
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.2rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Previous</span>
                      <strong style={{ fontSize: "1rem", color: "var(--text-secondary)", textDecoration: budgetDiff !== 0 ? "line-through" : "none" }}>
                        {oldCurrency.xlmStr}
                      </strong>
                    </div>
                    <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Revised</span>
                      <strong style={{ fontSize: "1.15rem", color: "var(--role-accent)" }}>
                        {currentCurrency.xlmStr}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 800, color: "var(--text-muted)" }}>
                    Financial Delta
                  </span>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: budgetDiff === 0 ? "var(--text-muted)" : budgetDiff < 0 ? "var(--accent-green)" : "var(--accent-warning)", marginTop: "0.15rem" }}>
                    {budgetDiff === 0 ? "No change in total budget" : `${budgetDiff > 0 ? "+" : ""}${budgetDiff.toFixed(1)} XLM (${budgetDiff > 0 ? "Increased" : "Reduced"})`}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    ≈ {currentCurrency.phpStr}
                  </span>
                </div>
              </div>

              {/* Remarks Comparison (Admin Feedback vs SK Counter-Notes) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "12px", padding: "0.9rem 1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--accent-danger)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <AlertCircle size={13} /> Admin Feedback / Instructions
                  </span>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                    {proposal.adminRevisionNotes || "No specific administrative revision notes recorded."}
                  </p>
                </div>

                <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "12px", padding: "0.9rem 1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--accent-green)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <CheckCircle2 size={13} /> SK Resubmission Counter-Notes
                  </span>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                    {proposal.skCounterNotes || "No specific counter-response notes attached."}
                  </p>
                </div>
              </div>

              {/* Side-by-Side Milestone Phases Comparison */}
              <div>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Layers size={15} style={{ color: "var(--role-accent)" }} />
                  Milestone Phases & Deliverable Requirements Comparison
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {/* Left Column: Previous / Suggested Breakdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Previous Snapshot ({oldPhases.length > 0 ? oldPhases.length : "Default"} Phases)
                    </div>
                    {oldPhases.length > 0 ? (
                      oldPhases.map((ph, idx) => {
                        const phaseNum = ph.phaseNumber || idx + 1;
                        const cleanTitle = ph.title.toLowerCase().startsWith(`phase ${phaseNum}:`) ||
                        ph.title.toLowerCase().startsWith(`phase ${phaseNum} -`) ||
                        ph.title.toLowerCase().startsWith(`phase ${phaseNum} `)
                          ? ph.title
                          : `Phase ${phaseNum}: ${ph.title}`;

                        return (
                          <div key={idx} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "0.75rem", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.35rem", opacity: 0.85 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--text-primary)" }}>
                              <span>{cleanTitle}</span>
                              <span style={{ color: "var(--text-muted)" }}>{ph.percentage}%</span>
                            </div>
                            {ph.targetDate && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>📅 {ph.targetDate}</div>
                            )}
                            {ph.description && (
                              <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.3 }}>{ph.description}</div>
                            )}
                            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                              {ph.adminOnlyProofRequired ? (
                                <span className="badge badge-warning" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>🔒 Admin-Only Proof</span>
                              ) : (
                                <span className="badge badge-neutral" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>🌐 Public Citizen Proof</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ background: "var(--bg-elevated)", border: "1px dashed var(--border-subtle)", borderRadius: "10px", padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                        Initial proposal phase state
                      </div>
                    )}
                  </div>

                  {/* Right Column: Current Revised Breakdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--role-accent)", textTransform: "uppercase" }}>
                      Current Revised ({currentPhases.length} Phases)
                    </div>
                    {currentPhases.map((ph, idx) => {
                      const phaseNum = ph.phaseNumber || idx + 1;
                      const cleanTitle = ph.title.toLowerCase().startsWith(`phase ${phaseNum}:`) ||
                      ph.title.toLowerCase().startsWith(`phase ${phaseNum} -`) ||
                      ph.title.toLowerCase().startsWith(`phase ${phaseNum} `)
                        ? ph.title
                        : `Phase ${phaseNum}: ${ph.title}`;

                      return (
                        <div key={idx} style={{ background: "var(--bg-elevated)", border: "1.5px solid rgba(99, 102, 241, 0.35)", borderRadius: "10px", padding: "0.75rem", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "var(--text-primary)" }}>
                            <span>{cleanTitle}</span>
                            <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>
                              {ph.percentage}% ({ph.amountXlm?.toFixed(1) || ((currentBudget * ph.percentage) / 100).toFixed(1)} XLM)
                            </span>
                          </div>
                          {ph.targetDate && (
                            <div style={{ fontSize: "0.72rem", color: "var(--role-accent)", fontWeight: 700 }}>📅 Target: {ph.targetDate}</div>
                          )}
                          {ph.description && (
                            <div style={{ fontSize: "0.74rem", color: "var(--text-primary)", lineHeight: 1.35 }}>{ph.description}</div>
                          )}
                          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                            {ph.adminOnlyProofRequired ? (
                              <span className="badge badge-warning" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", fontWeight: 800 }}>🔒 Admin-Only Proof Required</span>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", fontWeight: 700 }}>🌐 Public Citizen Proof</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Timeline Tab */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {history.length > 0 ? (
                history.map((entry, idx) => (
                  <div key={idx} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "12px", padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className={`badge ${entry.author === "admin" ? "badge-danger" : "badge-success"}`} style={{ fontSize: "0.72rem", textTransform: "uppercase" }}>
                          {entry.author === "admin" ? "Barangay Admin" : "SK Proposer"}
                        </span>
                        <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{entry.authorName}</strong>
                      </div>
                      <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock size={12} /> {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.84rem", color: "var(--text-primary)", background: "var(--bg-surface)", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid var(--border-subtle)", lineHeight: 1.45 }}>
                      {entry.notes || "No notes recorded."}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                      Budget at this snapshot: <strong>{entry.budgetXlm} XLM</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No previous revision history entries recorded yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
