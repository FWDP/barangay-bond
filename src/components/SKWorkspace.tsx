import React, { useState } from "react";
import { createProject, submitMilestoneProof } from "../transactions/transactions";
import type { Project, TransactionStatus } from "../types";

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
  const [projName, setProjName] = useState("");
  const [budgetXlm, setBudgetXlm] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState("");

  const [selectedProjId, setSelectedProjId] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofError, setProofError] = useState("");

  // Filter projects created by this user that require Milestone 1 proof
  const projectsAwaitingProof = projects.filter(
    (p) =>
      p.creator.toLowerCase() === skAddress.toLowerCase() &&
      p.status === 0 &&
      p.milestone1Status === 0
  );

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    const budgetNum = parseFloat(budgetXlm);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setCreateError("Budget must be a positive number.");
      return;
    }

    if (!projName.trim()) {
      setCreateError("Project name is required.");
      return;
    }

    onExecute((onStatusChange) => {
      return createProject(
        skAddress,
        projName.trim(),
        budgetNum,
        description.trim(),
        onStatusChange
      );
    });

    setProjName("");
    setBudgetXlm("");
    setDescription("");
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

  return (
    <div className="sk-workspace grid-2">
      {/* Create Project Panel */}
      <div className="panel-card">
        <h2 className="panel-title">Launch New Project</h2>
        <p className="panel-subtitle">
          Submit budget details to lock in native escrow. 50% mobilization will release immediately.
        </p>

        <form onSubmit={handleCreateProject} className="panel-form">
          {createError && <p className="form-error-msg">{createError}</p>}

          <div className="form-group">
            <label htmlFor="proj-name">Project Name</label>
            <input
              id="proj-name"
              type="text"
              className="form-control"
              placeholder="e.g. Youth Hub Solar System"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="budget-xlm">Escrow Budget (XLM)</label>
            <input
              id="budget-xlm"
              type="number"
              step="0.0000001"
              className="form-control"
              placeholder="e.g. 500"
              value={budgetXlm}
              onChange={(e) => setBudgetXlm(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Scope / Description</label>
            <textarea
              id="description"
              className="form-control"
              rows={3}
              placeholder="Provide a detailed description of the project deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-100">
            Lock Escrow & Deploy Project
          </button>
        </form>
      </div>

      {/* Upload Proof Panel */}
      <div className="panel-card">
        <h2 className="panel-title">Milestone Work Audit</h2>
        <p className="panel-subtitle">
          Upload project implementation proof to trigger voter evaluation and release Phase 2.
        </p>

        {projectsAwaitingProof.length === 0 ? (
          <div className="empty-panel-state">
            <p>You have no active projects awaiting milestone proof submission.</p>
          </div>
        ) : (
          <form onSubmit={handleUploadProof} className="panel-form">
            {proofError && <p className="form-error-msg">{proofError}</p>}

            <div className="form-group">
              <label htmlFor="select-project">Select Project</label>
              <select
                id="select-project"
                className="form-control"
                value={selectedProjId}
                onChange={(e) => setSelectedProjId(e.target.value)}
                required
              >
                <option value="">-- Choose Active Project --</option>
                {projectsAwaitingProof.map((p) => (
                  <option key={p.id} value={p.id}>
                    Project #{p.id}: {p.name} ({p.budget} XLM)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="proof-url">Audit Documentation Link (URL)</label>
              <input
                id="proof-url"
                type="url"
                className="form-control"
                placeholder="e.g. https://ipfs.io/ipfs/Qm..."
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100">
              Submit Milestone 1 Proof
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
