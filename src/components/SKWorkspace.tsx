import React, { useState } from "react";
import { createProject, submitMilestoneProof } from "../transactions/transactions";
import type { Project, TransactionStatus } from "../types";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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
  const isVerified = 
    !!profile && 
    profile.verified === true && 
    profile.verificationStatus === "approved" && 
    profile.status === "active" && 
    !!profile.walletAddress;

  // Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [projName, setProjName] = useState("");
  const [budgetXlm, setBudgetXlm] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState("");

  const [selectedProjId, setSelectedProjId] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofError, setProofError] = useState("");

  // Filter projects created by this user
  const myProjects = projects.filter(
    (p) => p.creator.toLowerCase() === skAddress.toLowerCase()
  );

  const projectsAwaitingProof = myProjects.filter(
    (p) => p.status === 0 && p.milestone1Status === 0
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
      setWizardStep(3);
    }
  };

  const handlePrevStep = () => {
    setWizardStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreateProject = () => {
    setCreateError("");
    const budgetNum = parseFloat(budgetXlm);

    onExecute((onStatusChange) => {
      return createProject(
        skAddress,
        projName.trim(),
        budgetNum,
        description.trim(),
        onStatusChange
      );
    });

    // Reset wizard
    setProjName("");
    setBudgetXlm("");
    setDescription("");
    setWizardStep(1);
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

    onExecute((onStatusChange) => {
      return submitMilestoneProof(
        skAddress,
        Number(selectedProjId),
        1, // Milestone 1 index
        proofUrl.trim(),
        onStatusChange
      );
    });

    setSelectedProjId("");
    setProofUrl("");
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
    <div className="sk-workspace grid-2">
      {/* Create Project Wizard Panel */}
      <div className="panel-card">
        {!isVerified ? (
          <>
            <h2 className="panel-title">Propose Community Escrow</h2>
            <p className="panel-subtitle">Submit budget details to lock in native escrow.</p>
            <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #cbd5e1", padding: "1.5rem", borderRadius: "16px", fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500, textAlign: "center" }}>
              🔒 Escrow proposal wizard is locked. Proposing project budgets requires an approved Barangay verification status.
              <div style={{ marginTop: "0.5rem", color: "var(--warning)", fontWeight: 700 }}>Status: Awaiting Barangay Admin Review</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 className="panel-title">Propose Community Escrow</h2>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--role-accent)", background: "var(--role-bg)", padding: "0.2rem 0.6rem", borderRadius: "6px" }}>
                Step {wizardStep} of 3
              </span>
            </div>

            {createError && <p className="form-error-msg mb-4">{createError}</p>}
          </>
        )}

        {isVerified && wizardStep === 1 && (
          <div className="panel-form">
            <div className="form-group">
              <label>Project Initiative Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. WiFi Hubs & Libraries Development"
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
                placeholder="Provide a detailed scope of work. What will contractors deliver in Phase 1 and Phase 2?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary w-100" onClick={handleNextStep}>
              Next Step: Configure Budget <ChevronRight size={16} style={{ marginLeft: "0.5rem" }} />
            </button>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="panel-form">
            <div className="form-group">
              <label>Escrow Budget Allocation (XLM)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                placeholder="e.g. 500"
                value={budgetXlm}
                onChange={(e) => setBudgetXlm(e.target.value)}
                required
              />
            </div>
            {budgetXlm && parseFloat(budgetXlm) > 0 && (
              <div style={{ background: "var(--role-bg)", padding: "1.2rem", borderRadius: "12px", border: "1px solid var(--border-glass)", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--role-accent)" }}>Tranche Splits Estimator</span>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                  <span>🚀 50% Upfront Mobilization:</span>
                  <strong>{(parseFloat(budgetXlm) / 2).toFixed(2)} XLM</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                  <span>🔒 50% Locked Escrow:</span>
                  <strong>{(parseFloat(budgetXlm) / 2).toFixed(2)} XLM</strong>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-outline-navy flex-grow" onClick={handlePrevStep}>
                <ArrowLeft size={16} style={{ marginRight: "0.5rem" }} /> Back
              </button>
              <button className="btn btn-primary flex-grow" onClick={handleNextStep}>
                Next: Review Project
              </button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="panel-form">
            <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #cbd5e1", padding: "1.5rem", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", color: "var(--text-primary)" }}>{projName}</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>{description}</p>
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem", display: "flex", justifyContent: "space-between" }}>
                <span>Escrow Budget:</span>
                <strong>{budgetXlm} XLM</strong>
              </div>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
              ⚠️ Deploying this escrow requires an on-chain smart contract proposal. A Freighter wallet popup will launch to authorize the XLM locked balance.
            </p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-outline-navy flex-grow" onClick={handlePrevStep}>
                <ArrowLeft size={16} style={{ marginRight: "0.5rem" }} /> Back
              </button>
              <button className="btn btn-primary flex-grow" onClick={handleCreateProject}>
                Approve & Deploy Escrow
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Proof & Project Status Timeline */}
      <div className="panel-form" style={{ gap: "2rem" }}>
        {/* Upload Proof Panel */}
        <div className="panel-card">
          <h2 className="panel-title">Upload Milestone Deliverables</h2>
          <p className="panel-subtitle">Upload completion receipts or documentation link to trigger youth audits.</p>

          {!isVerified ? (
            <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #cbd5e1", padding: "1.5rem", borderRadius: "16px", fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500, textAlign: "center" }}>
              🔒 Proof upload forms are locked. Uploading receipts requires verified SK status.
              <div style={{ marginTop: "0.5rem", color: "var(--warning)", fontWeight: 700 }}>Status: Awaiting Barangay Admin Review</div>
            </div>
          ) : projectsAwaitingProof.length === 0 ? (
            <div className="empty-panel-state" style={{ padding: "2rem" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>No active allocations awaiting milestone proof submissions.</p>
            </div>
          ) : (
            <form onSubmit={handleUploadProof} className="panel-form">
              {proofError && <p className="form-error-msg">{proofError}</p>}

              <div className="form-group">
                <label>Select Project</label>
                <select
                  className="form-control"
                  value={selectedProjId}
                  onChange={(e) => setSelectedProjId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Project Initiative --</option>
                  {projectsAwaitingProof.map((p) => (
                    <option key={p.id} value={p.id}>
                      Project #{p.id}: {p.name} ({p.budget} XLM)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Documentation IPFS / HTTP Link</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="e.g. https://ipfs.io/ipfs/Qm..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100">
                Submit Phase Deliverables Proof
              </button>
            </form>
          )}
        </div>

        {/* Project Tracker Ledger */}
        <div className="panel-card" style={{ maxHeight: "380px", overflowY: "auto" }}>
          <h2 className="panel-title">Active Project Allocations</h2>
          {myProjects.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>You have proposed zero projects so far.</p>
          ) : (
            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myProjects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span style={{ fontWeight: 700 }}>{p.name}</span>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>
                          Budget: {p.budget} XLM
                        </div>
                      </td>
                      <td>{getStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
