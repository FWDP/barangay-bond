import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { submitMilestoneProof } from "../transactions/transactions";
import type { Project, ProjectProposal, ProjectPhase, TransactionStatus } from "../types";
import { ChevronRight, ArrowLeft, Bot, Sparkles, Plus, Trash2, Send, Edit3, GitCompare, Lock, Upload, Wand2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { proposalRepository } from "../repositories/proposal.repository";
import { notificationRepository } from "../repositories/notification.repository";
import { auditRepository } from "../repositories/audit.repository";
import { useLoading } from "../contexts/LoadingContext";
import { formatXlmWithPhp, formatXlmToPhp, fetchLiveXlmRate } from "../utils/currency";
import { aiProposalAdvisorService, type AIAdvisorResponse } from "../services/aiProposalAdvisor.service";
import { aiImageGenerator } from "../services/aiImageGenerator.service";
import { ImageCarousel } from "./ImageCarousel";
import { RevisionDiffModal } from "./RevisionDiffModal";

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

  // AI Governance Buddy & Phase States
  const [aiResult, setAiResult] = useState<AIAdvisorResponse | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [applyAITotalBudget, setApplyAITotalBudget] = useState(true);
  const [selectedAIPhases, setSelectedAIPhases] = useState<Record<number, boolean>>({});
  const [customAIPrompt, setCustomAIPrompt] = useState("");

  // 2-Way Proposal Revision Loop & Diff States
  const [editingProposal, setEditingProposal] = useState<ProjectProposal | null>(null);
  const [skCounterReply, setSkCounterReply] = useState("");
  const [reviewingRevisionProp, setReviewingRevisionProp] = useState<ProjectProposal | null>(null);
  const [revisionBudgetXlm, setRevisionBudgetXlm] = useState("");
  const [revisionPhases, setRevisionPhases] = useState<ProjectPhase[]>([]);
  const [skReplyNotes, setSkReplyNotes] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [diffModalProposal, setDiffModalProposal] = useState<ProjectProposal | null>(null);

  // Multi-Image & Reimagine States
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showReimagineModal, setShowReimagineModal] = useState(false);
  const [reimaginePrompt, setReimaginePrompt] = useState("");
  const [quickEditProp, setQuickEditProp] = useState<ProjectProposal | null>(null);
  const [quickEditName, setQuickEditName] = useState("");
  const [quickEditDesc, setQuickEditDesc] = useState("");
  const [quickEditImages, setQuickEditImages] = useState<string[]>([]);
  const [quickEditNewImg, setQuickEditNewImg] = useState("");
  const [quickEditPhases, setQuickEditPhases] = useState<ProjectPhase[]>([]);
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);

  // Dual Proof Submission States (Public vs Admin)
  const [publicProofUrls, setPublicProofUrls] = useState<string[]>([]);
  const [newPublicProofUrl, setNewPublicProofUrl] = useState("");
  const [adminProofUrls, setAdminProofUrls] = useState<string[]>([]);
  const [newAdminProofUrl, setNewAdminProofUrl] = useState("");

  const handleFileUpload = (files: FileList | null, onAddUrls: (newUrls: string[]) => void) => {
    if (!files || files.length === 0) return;
    const uploaded: string[] = [];
    let count = 0;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        if (res) uploaded.push(res);
        count++;
        if (count === files.length) {
          onAddUrls(uploaded);
        }
      };
      reader.readAsDataURL(file);
    });
  };

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

  const handleAskAIBuddy = async (overridePrompt?: string | React.MouseEvent) => {
    setIsAnalyzingAI(true);
    startLoading({
      category: "ai",
      title: "🤖 Gemini AI Governance Audit",
      message: `Auditing "${projName || "Project Proposal"}" against real-world Philippine market benchmarks...`,
      steps: [
        "Connecting to Gemini 2.5 Flash API",
        "Auditing Real-World Philippine Prices & Borrowing",
        "Generating Optimal Tranche Allocations",
      ],
    });

    const activePrompt = typeof overridePrompt === "string" ? overridePrompt : customAIPrompt;

    try {
      updateLoading("Fetching real-world Philippine market prices...", 1);
      const res = await aiProposalAdvisorService.analyzeProposal(
        projName.trim(),
        description.trim(),
        parseFloat(budgetXlm) || 0,
        phases,
        activePrompt.trim()
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

    // Adopt AI Title & Description if provided
    if (aiResult.improvedProjectName) {
      setProjName(aiResult.improvedProjectName);
    }
    if (aiResult.improvedDescription) {
      setDescription(aiResult.improvedDescription);
    }

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
      const totalPctSum = chosen.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      const isAlready100 = totalPctSum === 100;

      const rebalanced = chosen.map((p, idx) => {
        let pct = p.percentage;
        if (!isAlready100) {
          const evenPct = Math.floor(100 / chosen.length);
          const remainder = 100 - (evenPct * chosen.length);
          pct = idx === 0 ? evenPct + remainder : evenPct;
        }
        return {
          phaseNumber: idx + 1,
          title: p.title || `Phase ${idx + 1}: Implementation`,
          description: p.description || "",
          requiredProofs: p.requiredProofs || "",
          targetDate: p.targetDate || "",
          percentage: pct,
          amountXlm: (currentTotal * pct) / 100,
        };
      });
      setPhases(rebalanced);
    }

    if (wizardStep === 1) {
      setWizardStep(2);
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
        setCreateError("Please provide a project initiative title and description.");
        return;
      }
      const budgetNum = parseFloat(budgetXlm);
      if (budgetNum > 0 && phases.length === 0) {
        setPhases([
          { phaseNumber: 1, title: "Phase 1: Mobilization & Procurement", percentage: 40, amountXlm: (budgetNum * 40) / 100, description: "Initial setup, equipment procurement, and materials." },
          { phaseNumber: 2, title: "Phase 2: Project Execution", percentage: 30, amountXlm: (budgetNum * 30) / 100, description: "Core activity rollout and milestone delivery." },
          { phaseNumber: 3, title: "Phase 3: Final Turnover & Audit", percentage: 30, amountXlm: (budgetNum * 30) / 100, description: "Project completion, community turnover, and deliverables inspection." }
        ]);
      }
      setWizardStep(2);
    } else if (wizardStep === 2) {
      const budgetNum = parseFloat(budgetXlm);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        setCreateError("Escrow budget must be a positive number.");
        return;
      }
      if (phases.length === 0) {
        setCreateError("Please add at least 1 tranche phase or click '🤖 Ask AI Buddy to Generate Tranches'.");
        return;
      }
      const sumPct = phases.reduce((acc, p) => acc + p.percentage, 0);
      if (sumPct !== 100) {
        setCreateError(`Total phase percentages must sum up to 100% (currently ${sumPct}%). Click '✨ Auto-Balance to 100%'.`);
        return;
      }
      setWizardStep(3);
    }
  };

  const handlePrevStep = () => {
    setWizardStep((prev) => Math.max(prev - 1, 1));
  };

  const handleStartEditingProposal = (prop: ProjectProposal) => {
    setEditingProposal(prop);
    setProjName(prop.projectName);
    setDescription(prop.description);
    setImageUrls(prop.imageUrls || []);
    const targetBudget = prop.suggestedBudgetXlm || prop.proposedBudgetXlm;
    setBudgetXlm(targetBudget.toString());
    const targetPhases = prop.suggestedPhases && prop.suggestedPhases.length > 0
      ? prop.suggestedPhases
      : prop.phases && prop.phases.length > 0
      ? prop.phases
      : [];
    setPhases(targetPhases.map((p, idx) => ({
      ...p,
      phaseNumber: idx + 1,
      amountXlm: p.amountXlm || ((targetBudget * p.percentage) / 100),
    })));
    setSkCounterReply(prop.skCounterNotes || "");
    setWizardStep(2); // Jump directly into Step 2: Milestones & Tranches!
    setActiveSKTab("create");
  };

  const handleCancelEditingProposal = () => {
    setEditingProposal(null);
    setProjName("");
    setBudgetXlm("");
    setDescription("");
    setImageUrls([]);
    setPhases([]);
    setSkCounterReply("");
    setWizardStep(1);
  };

  const handleOpenQuickEdit = (prop: ProjectProposal) => {
    setQuickEditProp(prop);
    setQuickEditName(prop.projectName);
    setQuickEditDesc(prop.description);
    setQuickEditImages(prop.imageUrls || []);
    setQuickEditNewImg("");
    setQuickEditPhases((prop.phases || []).map((p, i) => ({ ...p, phaseNumber: p.phaseNumber || i + 1 })));
  };

  const handleSaveQuickEdit = async () => {
    if (!quickEditProp?.id || !profile) return;
    setIsSavingQuickEdit(true);
    try {
      await proposalRepository.updateProjectDetails(quickEditProp.id, {
        projectName: quickEditName.trim(),
        description: quickEditDesc.trim(),
        imageUrls: quickEditImages,
        phases: quickEditPhases,
        lastEditedBy: profile.displayName || profile.name || "SK Official",
        lastEditedByName: profile.displayName || profile.name || "SK Official",
        lastEditedByRole: "SK Official",
        lastEditedAt: new Date().toISOString(),
        lastEditedByUid: profile.uid,
      });

      // Notify Barangay Admin
      try {
        await notificationRepository.createNotification({
          targetUid: "",
          barangayId: profile.barangayId,
          title: `📝 Project Details Updated by SK`,
          message: `${profile.displayName || "SK Official"} updated project description, images, or milestone deliverables for "${quickEditName}".`,
          createdAt: new Date().toISOString(),
          read: false,
        });
      } catch (notifErr) {
        console.error("Failed to send admin notification:", notifErr);
      }

      // Write Audit Log
      try {
        await auditRepository.writeAuditLog({
          action: "SK Edited Project Details",
          category: "Proposal Management",
          severity: "Info",
          actorUid: profile.uid,
          actorName: profile.displayName || profile.name || "SK Official",
          actorRole: "sk_official",
          targetUid: "",
          targetName: "Barangay Admin",
          targetRole: "barangay_admin",
          barangayId: profile.barangayId,
          device: navigator.userAgent || "Web Browser",
          timestamp: new Date().toISOString(),
          notes: `SK Official updated details/images for proposal "${quickEditName}" (Budget locked at ${quickEditProp.proposedBudgetXlm} XLM).`,
        });
      } catch (auditErr) {
        console.error("Failed to write audit log:", auditErr);
      }

      setQuickEditProp(null);
    } catch (err) {
      console.error("Failed to save quick edit:", err);
    } finally {
      setIsSavingQuickEdit(false);
    }
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
    const isResubmit = !!editingProposal && !!editingProposal.id;

    startLoading({
      category: "crud",
      title: isResubmit ? "🚀 Resubmitting Revised Proposal" : "💾 Submitting SK Project Proposal",
      message: isResubmit
        ? `Updating proposal "${projName}" with revised tranches and counter-notes...`
        : `Writing proposal "${projName}" and tranche schedule to Firestore...`,
      steps: [
        "Validating Proposal Parameters",
        isResubmit ? "Updating Firestore Proposal Document" : "Writing Firestore Proposal Document",
        "Notifying Barangay Admin",
      ],
    });

    try {
      if (isResubmit) {
        updateLoading("Updating proposal in Barangay Firestore Database...", 1);
        const historyEntry = {
          author: "sk" as const,
          authorName: profile.displayName || profile.name || "SK Official",
          notes: skCounterReply.trim() || "Resubmitted proposal with updated deliverables and budget.",
          timestamp: new Date().toISOString(),
          budgetXlm: budgetNum,
          projectName: projName,
          description: description,
          imageUrls: imageUrls,
          phases: phases,
        };
        const updatedHistory = [...(editingProposal.revisionHistory || []), historyEntry];

        await proposalRepository.updateProposalStatus(
          editingProposal.id!,
          "pending_admin_approval",
          editingProposal.reviewedByAdminUid || profile.uid,
          {
            projectName: projName,
            description: description,
            proposedBudgetXlm: budgetNum,
            phases: phases,
            imageUrls: imageUrls,
            skCounterNotes: skCounterReply.trim(),
            revisionHistory: updatedHistory,
          }
        );

        // Audit Log
        try {
          await auditRepository.writeAuditLog({
            action: "SK Resubmitted Revised Proposal",
            category: "Proposal Submission",
            severity: "Info",
            actorUid: profile.uid,
            actorName: profile.displayName || profile.name || "SK Official",
            actorRole: "sk_official",
            targetUid: editingProposal.reviewedByAdminUid || "",
            targetName: "Barangay Admin",
            targetRole: "barangay_admin",
            barangayId: profile.barangayId || "",
            device: navigator.userAgent || "Web Browser",
            timestamp: new Date().toISOString(),
            notes: `SK Official resubmitted revised proposal "${projName}" (${budgetNum} XLM) with updated tranches and counter-notes.`,
          });
        } catch (auditErr) {
          console.error("Failed to write audit log:", auditErr);
        }

        // Notify Admin
        try {
          await notificationRepository.createNotification({
            targetUid: editingProposal.reviewedByAdminUid || "",
            barangayId: profile.barangayId,
            title: `🔄 Revised Proposal Resubmitted: ${projName}`,
            message: `${profile.displayName || "SK Official"} resubmitted revised proposal "${projName}" (${budgetNum} XLM). Reply: "${skCounterReply.trim() || "Ready for review"}"`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        } catch (notifErr) {
          console.error("Failed to send notification:", notifErr);
        }

        setCreateSuccess("Revised proposal successfully resubmitted to Barangay Admin for review!");
        handleCancelEditingProposal();
      } else {
        updateLoading("Writing new proposal to Barangay Firestore Database...", 1);
        const proposalData: Omit<ProjectProposal, "id"> = {
          barangayId: profile.barangayId,
          barangayName: profile.barangayName || "Barangay",
          skOfficialUid: profile.uid,
          skOfficialAddress: skAddress,
          skOfficialName: profile.displayName || profile.name || "SK Official",
          projectName: projName,
          description: description,
          imageUrls: imageUrls,
          proposedBudgetXlm: budgetNum,
          proposedMobilizationPct: phases[0]?.percentage || 50,
          phases: phases,
          status: "pending_admin_approval",
          createdAt: new Date().toISOString(),
          revisionHistory: [
            {
              author: "sk",
              authorName: profile.displayName || profile.name || "SK Official",
              notes: "Initial project proposal submitted.",
              timestamp: new Date().toISOString(),
              budgetXlm: budgetNum,
              projectName: projName,
              description: description,
              imageUrls: imageUrls,
              phases: phases,
            }
          ]
        };

        await proposalRepository.createProposal(proposalData);
        updateLoading("Proposal submitted successfully!", 2);
        setCreateSuccess("Proposal submitted to Barangay Admin successfully! Awaiting review.");
      }

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
          onStatusChange,
          profile?.inAppWalletSecret || undefined
        );

        const projId = Number(selectedProjId);
        const matchingProp = proposals.find(
          (prop) => prop.onChainProjectId === projId ||
            prop.projectName.toLowerCase() === projects.find((p) => p.id === projId)?.name.toLowerCase()
        );

        if (matchingProp && matchingProp.id) {
          const currentPub = matchingProp.publicProofUrls || {};
          const currentAdm = matchingProp.adminProofUrls || {};
          const finalPublicList = publicProofUrls.length > 0 ? publicProofUrls : (proofUrl.trim() ? [proofUrl.trim()] : []);
          
          await proposalRepository.updateProposal(matchingProp.id, {
            publicProofUrls: {
              ...currentPub,
              [milestoneIndex]: finalPublicList,
            },
            adminProofUrls: {
              ...currentAdm,
              [milestoneIndex]: adminProofUrls,
            },
          });
        }

        if (profile?.barangayId) {
          try {
            await notificationRepository.createNotification({
              barangayId: profile.barangayId,
              targetUid: "all",
              title: "📢 Milestone Proof Submitted for Voting",
              message: `SK Official ${profile.name} submitted deliverables for Phase ${milestoneIndex} of '${targetProj?.name || "Civic Project"}'. Please inspect and cast your vote in the Youth Dashboard!`,
              createdAt: new Date().toISOString(),
              read: false
            });
          } catch (notifErr) {
            console.warn("Could not dispatch broadcast notification:", notifErr);
          }
        }

        setProofUrl("");
        setPublicProofUrls([]);
        setAdminProofUrls([]);
        setSelectedProjId("");
        return txHash;
      } catch (err: any) {
        console.error("Failed to submit proof:", err);
        throw err;
      }
    });
  };

  // Top Tab Switcher for SK Workspace
  const [activeSKTab, setActiveSKTab] = useState<"create" | "deliverables" | "pipeline">("create");

  const getProposalBadge = (status: string) => {
    if (status === "approved_onchain") {
      return <span className="badge badge-success">✓ Approved On-Chain</span>;
    }
    if (status === "rejected") {
      return <span className="badge badge-danger">✕ Rejected</span>;
    }
    if (status === "revision_requested") {
      return <span className="badge badge-warning" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706", border: "1px solid rgba(245, 158, 11, 0.3)" }}>⚠️ Revisions Requested</span>;
    }
    return <span className="badge badge-info">⏳ Pending Admin Review</span>;
  };

  const openRevisionModal = (prop: ProjectProposal) => {
    setReviewingRevisionProp(prop);
    const targetBudget = prop.suggestedBudgetXlm || prop.proposedBudgetXlm;
    setRevisionBudgetXlm(targetBudget.toString());
    const targetPhases = prop.suggestedPhases && prop.suggestedPhases.length > 0
      ? prop.suggestedPhases
      : prop.phases && prop.phases.length > 0
      ? prop.phases
      : [];
    setRevisionPhases(targetPhases.map((p) => ({
      ...p,
      amountXlm: p.amountXlm || ((targetBudget * p.percentage) / 100),
    })));
    setSkReplyNotes("");
  };

  const handleAcceptAdminRevisions = async (prop: ProjectProposal) => {
    if (!profile?.uid || !prop.id) return;
    setIsSubmittingRevision(true);
    startLoading({
      category: "crud",
      title: "✓ Concurring with Admin Revisions",
      message: `Accepting adjustments and resubmitting "${prop.projectName}" for on-chain deployment...`,
    });

    const budget = parseFloat(revisionBudgetXlm) || prop.suggestedBudgetXlm || prop.proposedBudgetXlm;
    const historyEntry = {
      author: "sk" as const,
      authorName: profile.name || "SK Official",
      authorRole: "SK Official",
      notes: skReplyNotes.trim() || "Accepted Barangay Admin revisions. Ready for on-chain deployment.",
      timestamp: new Date().toISOString(),
      budgetXlm: budget,
      phases: revisionPhases,
      lastEditedByName: profile.name || "SK Official",
      lastEditedByRole: "SK Official",
    };

    const updatedHistory = [...(prop.revisionHistory || []), historyEntry];

    try {
      await proposalRepository.updateProposalStatus(prop.id, "pending_admin_approval", prop.reviewedByAdminUid || profile.uid, {
        proposedBudgetXlm: budget,
        phases: revisionPhases,
        skCounterNotes: skReplyNotes.trim() || "Concurred with Admin revisions.",
        revisionHistory: updatedHistory,
        lastEditedAt: new Date().toISOString(),
        lastEditedByName: profile.name || "SK Official",
        lastEditedByRole: "SK Official",
        lastEditedByUid: profile.uid,
      });

      // Write Audit Log
      try {
        await auditRepository.writeAuditLog({
          action: "SK Concurred with Proposal Revisions",
          category: "Proposal Submission",
          severity: "Info",
          actorUid: profile.uid,
          actorName: profile.name || "SK Official",
          actorRole: "sk_official",
          targetUid: prop.reviewedByAdminUid || "",
          targetName: "Barangay Admin",
          targetRole: "barangay_admin",
          barangayId: profile.barangayId || "",
          device: navigator.userAgent || "Web Browser",
          timestamp: new Date().toISOString(),
          notes: `SK Official concurred with revisions for proposal "${prop.projectName}". Revised budget: ${budget} XLM.`
        });
      } catch (auditErr) {
        console.error("Failed to write audit log:", auditErr);
      }

      // Notification to Barangay Admin
      if (prop.barangayId) {
        try {
          await notificationRepository.createNotification({
            targetUid: prop.reviewedByAdminUid || "",
            barangayId: prop.barangayId,
            title: "🎉 SK Concurred with Revisions",
            message: `SK Official ${profile.name || "Youth Leader"} has concurred with your revisions for "${prop.projectName}". Ready for final on-chain approval.`,
            createdAt: new Date().toISOString(),
            read: false
          });
        } catch (notifErr) {
          console.error("Failed to send notification:", notifErr);
        }
      }

      setReviewingRevisionProp(null);
    } catch (err) {
      console.error("Failed to accept revisions:", err);
    } finally {
      setIsSubmittingRevision(false);
      stopLoading();
    }
  };

  const handleCounterPropose = async (prop: ProjectProposal) => {
    if (!profile?.uid || !prop.id) return;
    setIsSubmittingRevision(true);
    startLoading({
      category: "crud",
      title: "🚀 Submitting Counter-Proposal",
      message: `Sending revised proposal for "${prop.projectName}" back to Barangay Admin...`,
    });

    const budget = parseFloat(revisionBudgetXlm) || prop.proposedBudgetXlm;
    const historyEntry = {
      author: "sk" as const,
      authorName: profile.name || "SK Official",
      authorRole: "SK Official",
      notes: skReplyNotes.trim() || "Submitted counter-proposals on budget / deliverables.",
      timestamp: new Date().toISOString(),
      budgetXlm: budget,
      phases: revisionPhases,
      lastEditedByName: profile.name || "SK Official",
      lastEditedByRole: "SK Official",
    };

    const updatedHistory = [...(prop.revisionHistory || []), historyEntry];

    try {
      await proposalRepository.updateProposalStatus(prop.id, "pending_admin_approval", prop.reviewedByAdminUid || profile.uid, {
        proposedBudgetXlm: budget,
        phases: revisionPhases,
        skCounterNotes: skReplyNotes.trim() || "Submitted counter-proposal.",
        revisionHistory: updatedHistory,
        lastEditedAt: new Date().toISOString(),
        lastEditedByName: profile.name || "SK Official",
        lastEditedByRole: "SK Official",
        lastEditedByUid: profile.uid,
      });

      // Write Audit Log
      try {
        await auditRepository.writeAuditLog({
          action: "SK Counter-Proposed Project Revisions",
          category: "Proposal Submission",
          severity: "Info",
          actorUid: profile.uid,
          actorName: profile.name || "SK Official",
          actorRole: "sk_official",
          targetUid: prop.reviewedByAdminUid || "",
          targetName: "Barangay Admin",
          targetRole: "barangay_admin",
          barangayId: profile.barangayId || "",
          device: navigator.userAgent || "Web Browser",
          timestamp: new Date().toISOString(),
          notes: `SK Official counter-proposed revisions for proposal "${prop.projectName}". Budget: ${budget} XLM. Remarks: "${skReplyNotes}".`
        });
      } catch (auditErr) {
        console.error("Failed to write audit log:", auditErr);
      }

      // Notification to Barangay Admin
      if (prop.barangayId) {
        try {
          await notificationRepository.createNotification({
            targetUid: prop.reviewedByAdminUid || "",
            barangayId: prop.barangayId,
            title: "🔄 SK Counter-Proposed Revisions",
            message: `SK Official ${profile.name || "Youth Leader"} has submitted counter-revisions on "${prop.projectName}". Notes: "${skReplyNotes}".`,
            createdAt: new Date().toISOString(),
            read: false
          });
        } catch (notifErr) {
          console.error("Failed to send notification:", notifErr);
        }
      }

      setReviewingRevisionProp(null);
    } catch (err) {
      console.error("Failed to counter-propose:", err);
    } finally {
      setIsSubmittingRevision(false);
      stopLoading();
    }
  };

  return (
    <div className="bank-section page-enter" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* 1. SECTION HEADER & TABS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>
            SK Project & Proposal Studio
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.2rem 0 0 0" }}>
            Create youth initiative proposals and submit proof of completed work
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="fintech-tabs-rail" style={{ padding: "0.25rem" }}>
          <button
            className={`fintech-tab-btn ${activeSKTab === "create" ? "active" : ""}`}
            onClick={() => setActiveSKTab("create")}
            style={{ padding: "0.45rem 1rem", fontSize: "0.82rem", fontWeight: 800 }}
          >
            ✨ Create Proposal
          </button>
          <button
            className={`fintech-tab-btn ${activeSKTab === "deliverables" ? "active" : ""}`}
            onClick={() => setActiveSKTab("deliverables")}
            style={{ padding: "0.45rem 1rem", fontSize: "0.82rem", fontWeight: 800 }}
          >
            📸 Submit Proof ({projectsAwaitingProof.length})
          </button>
          <button
            className={`fintech-tab-btn ${activeSKTab === "pipeline" ? "active" : ""}`}
            onClick={() => setActiveSKTab("pipeline")}
            style={{ padding: "0.45rem 1rem", fontSize: "0.82rem", fontWeight: 800 }}
          >
            📋 Proposals ({myProposals.length})
          </button>
        </div>
      </div>

      {/* 2. ACTIVE TAB RENDER */}
      {activeSKTab === "create" && (
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)" }}>
                Create New Project Proposal
              </h3>
              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                {wizardStep === 1 && "Step 1: Project Title & Objective"}
                {wizardStep === 2 && "Step 2: Budget Breakdown & AI Feasibility"}
                {wizardStep === 3 && "Step 3: Review & Submit to Barangay Admin"}
              </div>
            </div>
            <span className="badge badge-role">Step {wizardStep} of 3</span>
          </div>

          {!isVerified ? (
            <div style={{ background: "var(--bg-elevated)", borderRadius: "14px", padding: "1.75rem", textAlign: "center", color: "var(--text-muted)" }}>
              🔒 Proposal creation is locked. Proposing project budgets requires verified SK Official status.
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

              {/* STEP 1: BASIC INFO & TARGET BUDGET */}
              {wizardStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group">
                    <label>Project Initiative Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Barangay Youth Digital Study & WiFi Hub"
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Project Description & Scope</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Detail the community initiative scope. What will this project accomplish for the barangay youth?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  {/* Multi-Image File Upload & Gallery Input */}
                  <div className="form-group">
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Project Photos & Mockups (Multiple Images)</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400 }}>{imageUrls.length} attached</span>
                    </label>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="Paste Image URL (e.g. https://images.unsplash.com/...)"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        style={{ flex: "1 1 220px" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newImageUrl.trim()) {
                              setImageUrls([...imageUrls, newImageUrl.trim()]);
                              setNewImageUrl("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline tap-scale"
                        style={{ fontWeight: 700, whiteSpace: "nowrap" }}
                        onClick={() => {
                          if (newImageUrl.trim()) {
                            setImageUrls([...imageUrls, newImageUrl.trim()]);
                            setNewImageUrl("");
                          }
                        }}
                      >
                        + Add URL
                      </button>
                      <label className="btn btn-outline tap-scale" style={{ fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem", whiteSpace: "nowrap" }}>
                        <Upload size={14} /> Upload Files
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => handleFileUpload(e.target.files, (newOnes) => setImageUrls([...imageUrls, ...newOnes]))}
                        />
                      </label>
                    </div>

                    {imageUrls.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
                        {imageUrls.map((url, imgIdx) => (
                          <div key={imgIdx} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-subtle)", height: "65px", background: "var(--bg-surface)" }}>
                            <img src={url} alt={`Project ${imgIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as any).src = "https://placehold.co/100x65?text=Image"; }} />
                            <button
                              type="button"
                              style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                              onClick={() => setImageUrls(imageUrls.filter((_, i) => i !== imgIdx))}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Target Budget Input directly in Step 1 */}
                  <div className="form-group">
                    <label>Target Project Budget (XLM) <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>(Optional or estimated)</span></label>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        placeholder="e.g. 150"
                        value={budgetXlm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBudgetXlm(val);
                          const total = parseFloat(val) || 0;
                          setPhases((prev) =>
                            prev.map((p) => ({
                              ...p,
                              amountXlm: (total * p.percentage) / 100,
                            }))
                          );
                        }}
                        style={{ fontSize: "0.95rem", fontWeight: 700 }}
                      />
                      {budgetXlm && (
                        <div style={{ minWidth: "140px", fontSize: "0.82rem", color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "0.5rem 0.75rem", borderRadius: "10px", border: "1px solid var(--border-subtle)", textAlign: "right" }}>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>PHP Value</span>
                          <strong style={{ color: "var(--accent-green)", fontSize: "0.92rem" }}>{formatXlmToPhp(parseFloat(budgetXlm) || 0)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-outline tap-scale"
                      style={{ flex: 1, minWidth: "220px", borderColor: "var(--role-accent)", color: "var(--role-accent)", fontWeight: 700 }}
                      onClick={handleAskAIBuddy}
                      disabled={isAnalyzingAI || !projName.trim()}
                    >
                      <Sparkles size={16} />
                      {isAnalyzingAI ? "AI Analyzing Scope..." : "✨ AI Budget & Milestone Advisor"}
                    </button>
                    <button className="btn btn-primary tap-scale" style={{ flex: 1, minWidth: "160px" }} onClick={handleNextStep}>
                      Next: Milestones Breakdown <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: MILESTONES & TRANCHE BREAKDOWN */}
              {wizardStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                  {/* Revision Alert Banner if Editing a Proposal */}
                  {editingProposal && (
                    <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1.5px solid rgba(245, 158, 11, 0.35)", borderRadius: "14px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#d97706", display: "flex", alignItems: "center", gap: "0.35rem", textTransform: "uppercase" }}>
                          ⚠️ Editing Proposal Under Revision: "{editingProposal.projectName}"
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline tap-scale"
                          onClick={handleCancelEditingProposal}
                          style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                        >
                          ✕ Cancel Edit
                        </button>
                      </div>
                      {editingProposal.adminRevisionNotes && (
                        <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "#92400e", lineHeight: 1.45, fontWeight: 600 }}>
                          📝 <strong>Admin Feedback:</strong> "{editingProposal.adminRevisionNotes}"
                        </p>
                      )}
                      {editingProposal.suggestedBudgetXlm !== undefined && (
                        <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                          Admin Suggested Budget: <strong style={{ color: "var(--text-primary)" }}>{editingProposal.suggestedBudgetXlm} XLM</strong> (≈ {formatXlmToPhp(editingProposal.suggestedBudgetXlm)})
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proposal Title & Description Quick Editor in Step 2 */}
                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 800, color: "var(--role-accent)", letterSpacing: "0.06em" }}>
                        Project Initiative Details (Editable in Step 2)
                      </span>
                      <span className="badge badge-info" style={{ fontSize: "0.72rem" }}>Step 2 of 3</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Project Title</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={projName}
                        onChange={(e) => setProjName(e.target.value)}
                        placeholder="Project title..."
                        style={{ fontWeight: 800, fontSize: "0.92rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Description & Proposed Dates / Scope</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Project description & timeline..."
                        style={{ fontSize: "0.82rem" }}
                      />
                    </div>
                  </div>

                  {/* Editable Total Escrow Budget Input */}
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 800 }}>Total Escrow Budget (XLM)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        placeholder="e.g. 150"
                        value={budgetXlm}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBudgetXlm(val);
                          const total = parseFloat(val) || 0;
                          setPhases((prev) =>
                            prev.map((p) => ({
                              ...p,
                              amountXlm: (total * p.percentage) / 100,
                            }))
                          );
                        }}
                        style={{ fontSize: "0.95rem", fontWeight: 700 }}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline tap-scale"
                      onClick={handleAskAIBuddy}
                      disabled={isAnalyzingAI}
                      style={{ minHeight: "42px", color: "var(--role-accent)", borderColor: "var(--role-accent-border)", fontWeight: 700 }}
                    >
                      <Bot size={16} />
                      {isAnalyzingAI ? "Auditing..." : "Re-Run AI Advisor"}
                    </button>
                  </div>

                  {budgetXlm && (
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "0.5rem 0.8rem", borderRadius: "10px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Estimated Philippine Peso Value:</span>
                      <strong style={{ color: "var(--accent-green)", fontSize: "0.95rem" }}>{formatXlmToPhp(parseFloat(budgetXlm) || 0)}</strong>
                    </div>
                  )}

                  {/* ✨ Custom AI Directives / Specific Adjustments (e.g. Uniforms paid by joiners) */}
                  <div style={{ background: "rgba(0, 125, 254, 0.05)", border: "1px solid rgba(0, 125, 254, 0.18)", borderRadius: "12px", padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: "0.35rem", textTransform: "uppercase" }}>
                      ✨ Custom AI Directives & Constraints (Optional)
                    </label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder='e.g. "Uniforms will be shouldered by joiners, do not budget jerseys. Only budget referees."'
                        value={customAIPrompt}
                        onChange={(e) => setCustomAIPrompt(e.target.value)}
                        style={{ fontSize: "0.82rem" }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm tap-scale"
                        onClick={() => handleAskAIBuddy()}
                        disabled={isAnalyzingAI}
                        style={{ whiteSpace: "nowrap", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <Sparkles size={13} /> {isAnalyzingAI ? "Applying..." : "Apply Prompt"}
                      </button>
                    </div>
                  </div>

                  {/* Tranche Phase Cards */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <label style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800 }}>
                        Milestone Tranches ({phases.length} Phases)
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline tap-scale"
                        onClick={handleAddPhase}
                        style={{ height: "30px", fontSize: "0.75rem", fontWeight: 700 }}
                      >
                        <Plus size={13} /> Add Phase
                      </button>
                    </div>

                    {phases.length === 0 ? (
                      <div style={{ background: "var(--bg-elevated)", border: "1px dashed var(--border-primary)", borderRadius: "14px", padding: "1.75rem", textAlign: "center" }}>
                        <Sparkles size={28} style={{ color: "var(--role-accent)", margin: "0 auto 0.5rem auto" }} />
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 0.75rem 0" }}>
                          No tranches configured yet. Let the AI Advisor suggest optimal phases.
                        </p>
                        <button type="button" className="btn btn-primary btn-sm tap-scale" onClick={handleAskAIBuddy}>
                          <Sparkles size={13} /> Generate Tranches with AI
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                        {phases.map((ph, idx) => {
                          const total = parseFloat(budgetXlm) || 0;
                          const phaseAmt = (total * ph.percentage) / 100;
                          return (
                            <div key={ph.phaseNumber} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", padding: "1rem", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="badge badge-info" style={{ fontSize: "0.72rem", fontWeight: 800 }}>
                                  Phase {ph.phaseNumber} {idx === 0 ? "• Upfront Mobilization" : "• Escrow Vote Release"}
                                </span>
                                {phases.length > 1 && (
                                  <button type="button" style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.72rem" }} onClick={() => handleRemovePhase(idx)}>
                                    <Trash2 size={13} /> Remove
                                  </button>
                                )}
                              </div>

                              {/* Phase Title Input */}
                              <div>
                                <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.25rem", display: "block" }}>
                                  Tranche Title
                                </label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder={`e.g. Phase ${ph.phaseNumber}: Equipment & Procurement`}
                                  value={ph.title}
                                  onChange={(e) => {
                                    const updated = [...phases];
                                    updated[idx].title = e.target.value;
                                    setPhases(updated);
                                  }}
                                  style={{ fontSize: "0.88rem" }}
                                />
                              </div>

                              {/* Phase Specific Deliverables Description */}
                              <div>
                                <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.25rem", display: "block" }}>
                                  Phase Deliverables & Scope
                                </label>
                                <textarea
                                  className="form-control"
                                  rows={2}
                                  placeholder="Describe the exact deliverables and proof documents for this specific milestone..."
                                  value={ph.description || ""}
                                  onChange={(e) => {
                                    const updated = [...phases];
                                    updated[idx].description = e.target.value;
                                    setPhases(updated);
                                  }}
                                  style={{ fontSize: "0.82rem" }}
                                />
                              </div>

                              {/* Target Completion Date / Timeline Input */}
                              <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.2rem", display: "block" }}>
                                  Target Milestone Date / Timeline <span style={{ fontWeight: 400 }}>(e.g. Sept 19, 2026 or Week 1)</span>
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. September 19, 2026"
                                  value={ph.targetDate || ""}
                                  onChange={(e) => {
                                    const updated = [...phases];
                                    updated[idx].targetDate = e.target.value;
                                    setPhases(updated);
                                  }}
                                  style={{ fontSize: "0.8rem" }}
                                />
                              </div>

                              {/* Two-Way XLM Amount & Percentage Sync Inputs */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                                <div>
                                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.2rem", display: "block" }}>
                                    Amount (XLM)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    className="form-control"
                                    placeholder="XLM"
                                    value={ph.amountXlm !== undefined && !isNaN(ph.amountXlm) ? ph.amountXlm : phaseAmt.toFixed(1)}
                                    onChange={(e) => {
                                      const newAmt = parseFloat(e.target.value) || 0;
                                      const newPct = total > 0 ? (newAmt / total) * 100 : 0;
                                      const updated = [...phases];
                                      updated[idx].amountXlm = newAmt;
                                      updated[idx].percentage = Math.round(newPct * 10) / 10;
                                      setPhases(updated);
                                    }}
                                    style={{ fontSize: "0.88rem", fontWeight: 700 }}
                                  />
                                </div>

                                <div>
                                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.2rem", display: "block" }}>
                                    Allocation (%)
                                  </label>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <input
                                      type="number"
                                      step="0.5"
                                      className="form-control"
                                      placeholder="%"
                                      value={ph.percentage}
                                      onChange={(e) => {
                                        const newPct = parseFloat(e.target.value) || 0;
                                        const updated = [...phases];
                                        updated[idx].percentage = newPct;
                                        updated[idx].amountXlm = Math.round(((total * newPct) / 100) * 10) / 10;
                                        setPhases(updated);
                                      }}
                                      style={{ fontSize: "0.88rem", fontWeight: 700 }}
                                    />
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700 }}>%</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", paddingTop: "0.2rem" }}>
                                <span>PHP Value: <strong style={{ color: "var(--text-primary)" }}>{formatXlmToPhp(phaseAmt)}</strong></span>
                                <span>{ph.percentage}% of {budgetXlm || 0} XLM</span>
                              </div>

                              {/* Optional Admin-Only Proof Toggle */}
                              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginTop: "0.3rem", padding: "0.4rem 0.6rem", background: "rgba(245, 158, 11, 0.08)", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                                <input
                                  type="checkbox"
                                  id={`skPhaseAdminProofToggle-${idx}`}
                                  checked={ph.adminOnlyProofRequired || false}
                                  onChange={(e) => {
                                    const updated = [...phases];
                                    updated[idx].adminOnlyProofRequired = e.target.checked;
                                    setPhases(updated);
                                  }}
                                  style={{ cursor: "pointer", width: "15px", height: "15px" }}
                                />
                                <label htmlFor={`skPhaseAdminProofToggle-${idx}`} style={{ fontSize: "0.74rem", fontWeight: 700, color: "#92400e", cursor: "pointer", margin: 0 }}>
                                  🔒 Require Admin-Only Internal Proof (Official Receipts, Tax Clearances, Bank Invoices)
                                </label>
                              </div>
                            </div>
                          );
                        })}

                        {/* Budget Allocation Summary Bar */}
                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div>
                            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: phases.reduce((acc, p) => acc + p.percentage, 0) === 100 ? "var(--accent-green)" : "#f87171" }}>
                              {phases.reduce((acc, p) => acc + p.percentage, 0) === 100
                                ? "✓ Budget 100% Fully Allocated"
                                : `⚠️ Total: ${phases.reduce((acc, p) => acc + p.percentage, 0)}% (Must equal 100%)`}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                              Allocated: {phases.reduce((acc, p) => acc + (p.amountXlm || ((parseFloat(budgetXlm) || 0) * p.percentage) / 100), 0).toFixed(1)} / {budgetXlm || 0} XLM
                            </div>
                          </div>
                          <button type="button" className="btn btn-sm btn-outline tap-scale" onClick={handleAutoBalance} style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                            ✨ Auto-Balance Remainder
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button className="btn btn-outline tap-scale" style={{ flex: 1 }} onClick={handlePrevStep}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button className="btn btn-primary tap-scale" style={{ flex: 1 }} onClick={handleNextStep}>
                      Review Proposal <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & SUBMIT */}
              {wizardStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "16px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div>
                        <span className="badge badge-role" style={{ marginBottom: "0.3rem" }}>Project Proposal</span>
                        <h4 style={{ fontSize: "1.15rem", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>{projName}</h4>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: "0.82rem", padding: "0.3rem 0.65rem", fontWeight: 800 }}>
                        {formatXlmWithPhp(budgetXlm).combined}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {description}
                    </p>
                    
                    {/* Project Photos Preview Carousel in Step 3 */}
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                          Project Mockup Photos ({imageUrls.length})
                        </span>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline tap-scale"
                            onClick={() => setShowReimagineModal(true)}
                            style={{ fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--role-accent)", fontWeight: 700 }}
                          >
                            <Wand2 size={13} /> 🎨 Reimagine with AI
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline tap-scale"
                            onClick={() => setImageUrls([])}
                            style={{ fontSize: "0.72rem", color: "#f87171", fontWeight: 700 }}
                          >
                            🗑️ Discard Image
                          </button>
                          <label className="btn btn-sm btn-outline tap-scale" style={{ fontSize: "0.72rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontWeight: 700 }}>
                            <Upload size={13} /> Upload Photos
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => handleFileUpload(e.target.files, (newOnes) => setImageUrls([...imageUrls, ...newOnes]))}
                            />
                          </label>
                        </div>
                      </div>

                      <ImageCarousel
                        images={imageUrls}
                        alt={projName}
                        height="200px"
                        rounded="12px"
                        showLightboxOnClick={true}
                      />
                    </div>

                    {/* Detailed Phase Review Cards */}
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                        Milestone Tranches & Deliverables Breakdown
                      </div>

                      {phases.map((ph) => {
                        const amt = (parseFloat(budgetXlm) * ph.percentage) / 100;
                        return (
                          <div key={ph.phaseNumber} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem 0.9rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong style={{ fontSize: "0.86rem", color: "var(--text-primary)" }}>{ph.title}</strong>
                              <span className="badge badge-info" style={{ fontSize: "0.74rem", fontWeight: 800 }}>
                                {amt.toFixed(1)} XLM ({ph.percentage}%)
                              </span>
                            </div>
                            {ph.description && (
                              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                                {ph.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                    {/* SK Reply / Counter-Explanation Note to Admin in Step 3 */}
                    {editingProposal && (
                      <div style={{ background: "rgba(0, 125, 254, 0.06)", border: "1px solid rgba(0, 125, 254, 0.22)", borderRadius: "12px", padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-blue)", display: "block" }}>
                          💬 Reply / Counter-Explanation Note to Barangay Admin
                        </label>
                        <textarea
                          className="form-control"
                          rows={2}
                          placeholder='e.g. "We adjusted the budget and deliverables to reflect borrowed sports gear from CDRRMO."'
                          value={skCounterReply}
                          onChange={(e) => setSkCounterReply(e.target.value)}
                          style={{ fontSize: "0.82rem" }}
                        />
                      </div>
                    )}

                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button className="btn btn-outline tap-scale" style={{ flex: 1 }} onClick={handlePrevStep} disabled={isSubmitting}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button className="btn btn-primary tap-scale" style={{ flex: 1.5, height: "48px", fontWeight: 800 }} onClick={handleSubmitProposal} disabled={isSubmitting}>
                      {isSubmitting ? "Processing..." : editingProposal ? "🚀 Resubmit Revised Proposal" : "Submit to Barangay Admin"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: MILESTONE DELIVERABLE PROOF UPLOAD */}
      {activeSKTab === "deliverables" && (
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)" }}>
              Upload Milestone Deliverables & Proof of Work
            </h3>
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
              Submit completion evidence to authorize the next smart contract milestone release
            </div>
          </div>

          {!isVerified ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "1rem 0" }}>
              🔒 Proof uploads locked. Requires verified SK Official status.
            </p>
          ) : projectsAwaitingProof.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "0.9rem", margin: 0 }}>
                No active on-chain projects currently awaiting milestone deliverables in your jurisdiction.
              </p>
            </div>
          ) : (
            <form onSubmit={handleUploadProof} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "12px", padding: "0.85rem 1rem", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <Sparkles size={16} style={{ color: "var(--role-accent)", flexShrink: 0, marginTop: "2px" }} />
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  <strong style={{ color: "var(--role-accent)" }}>Proof-Gated Milestone Consensus:</strong> Once you upload Phase 1 completion evidence (photos and receipts), community voting will automatically unlock for Katipunan ng Kabataan youth residents to review your work and vote to release Phase 2 escrow funds.
                </div>
              </div>

              {proofError && (
                <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", padding: "0.75rem", borderRadius: "10px", color: "#f87171", fontSize: "0.82rem" }}>
                  {proofError}
                </div>
              )}

              <div className="form-group">
                <label style={{ fontSize: "0.85rem", fontWeight: 800 }}>Select Project Initiative</label>
                <select
                  className="select-control"
                  value={selectedProjId}
                  onChange={(e) => setSelectedProjId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Active Project --</option>
                  {projectsAwaitingProof.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id}: {p.name} ({p.budget} XLM · Phase {p.currentPhase || 1})
                    </option>
                  ))}
                </select>
              </div>

              {/* 1. Public Field Deliverables Proof */}
              <div style={{ background: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "12px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--role-accent)", margin: 0 }}>
                    📸 Public Citizen Deliverable Photos ({publicProofUrls.length})
                  </label>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Visible to voting youth</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="Paste Photo URL (e.g. https://images.unsplash.com/... or IPFS)"
                    value={newPublicProofUrl}
                    onChange={(e) => setNewPublicProofUrl(e.target.value)}
                    style={{ flex: "1 1 220px" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newPublicProofUrl.trim()) {
                          setPublicProofUrls([...publicProofUrls, newPublicProofUrl.trim()]);
                          if (!proofUrl) setProofUrl(newPublicProofUrl.trim());
                          setNewPublicProofUrl("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline tap-scale"
                    onClick={() => {
                      if (newPublicProofUrl.trim()) {
                        setPublicProofUrls([...publicProofUrls, newPublicProofUrl.trim()]);
                        if (!proofUrl) setProofUrl(newPublicProofUrl.trim());
                        setNewPublicProofUrl("");
                      }
                    }}
                  >
                    + Add URL
                  </button>
                  <label className="btn btn-outline tap-scale" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <Upload size={14} /> Upload Photos
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileUpload(e.target.files, (newOnes) => {
                        setPublicProofUrls([...publicProofUrls, ...newOnes]);
                        if (!proofUrl && newOnes[0]) setProofUrl(newOnes[0]);
                      })}
                    />
                  </label>
                </div>

                {publicProofUrls.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "0.4rem" }}>
                    {publicProofUrls.map((url, pIdx) => (
                      <div key={pIdx} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", height: "60px", border: "1px solid var(--border-subtle)" }}>
                        <img src={url} alt={`Proof ${pIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as any).src = "https://placehold.co/80x60?text=Proof"; }} />
                        <button
                          type="button"
                          style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", fontSize: "9px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                          onClick={() => setPublicProofUrls(publicProofUrls.filter((_, i) => i !== pIdx))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Private Official Receipts / COA Compliance */}
              <div style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "12px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 800, color: "#d97706", margin: 0 }}>
                    📄 Official Receipts & COA Invoices ({adminProofUrls.length})
                  </label>
                  <span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: 700 }}>🔒 Strictly Private to Admin</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="Paste Voucher / Receipt PDF or Scan Link"
                    value={newAdminProofUrl}
                    onChange={(e) => setNewAdminProofUrl(e.target.value)}
                    style={{ flex: "1 1 220px" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newAdminProofUrl.trim()) {
                          setAdminProofUrls([...adminProofUrls, newAdminProofUrl.trim()]);
                          setNewAdminProofUrl("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline tap-scale"
                    onClick={() => {
                      if (newAdminProofUrl.trim()) {
                        setAdminProofUrls([...adminProofUrls, newAdminProofUrl.trim()]);
                        setNewAdminProofUrl("");
                      }
                    }}
                  >
                    + Add Receipt URL
                  </button>
                  <label className="btn btn-outline tap-scale" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <Upload size={14} /> Upload Receipt Scans
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) => handleFileUpload(e.target.files, (newOnes) => setAdminProofUrls([...adminProofUrls, ...newOnes]))}
                    />
                  </label>
                </div>

                {adminProofUrls.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "0.4rem" }}>
                    {adminProofUrls.map((_url, aIdx) => (
                      <div key={aIdx} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", height: "60px", border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#d97706" }}>Receipt #{aIdx + 1}</span>
                        <button
                          type="button"
                          style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", fontSize: "9px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                          onClick={() => setAdminProofUrls(adminProofUrls.filter((_, i) => i !== aIdx))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label style={{ fontSize: "0.85rem", fontWeight: 800 }}>Primary Deliverable Link for Soroban Smart Contract</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://ipfs.io/ipfs/... or https://drive.google.com/..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary tap-scale" style={{ minHeight: "46px", fontWeight: 800, marginTop: "0.5rem" }}>
                <Send size={15} /> Submit Deliverables for Citizen Audit
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: SUBMITTED PROPOSALS PIPELINE */}
      {activeSKTab === "pipeline" && (
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)" }}>
                My Submitted Proposals
              </h3>
              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                Track approval status from the Barangay Captain & Admin desk
              </div>
            </div>
            <span className="badge badge-outline">{myProposals.length} Submitted</span>
          </div>

          {myProposals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "0.88rem", margin: 0 }}>No proposals submitted yet. Use the "Create Proposal" tab to draft your first project.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {myProposals.map((prop) => {
                const isUnderRevision = prop.status === "revision_requested";
                return (
                  <div
                    key={prop.id}
                    className="stat-tile"
                    style={{
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                      borderRadius: "14px",
                      border: isUnderRevision ? "1.5px solid rgba(245, 158, 11, 0.4)" : undefined,
                      background: isUnderRevision ? "rgba(245, 158, 11, 0.03)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                      <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                          {prop.projectName}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          Budget: <strong style={{ color: "var(--text-primary)" }}>{prop.proposedBudgetXlm} XLM</strong> (≈ {formatXlmToPhp(prop.proposedBudgetXlm)})
                        </div>
                      </div>
                      {getProposalBadge(prop.status)}
                    </div>

                    {/* Admin Revision Feedback Callout if revision requested */}
                    {isUnderRevision && (
                      <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "10px", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#d97706", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span>📝 Barangay Admin Revision Remarks:</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "#92400e", lineHeight: 1.4 }}>
                          "{prop.adminRevisionNotes || "Admin adjusted budget / deliverables. Please review and respond."}"
                        </p>
                        {prop.suggestedBudgetXlm !== undefined && (
                          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                            Admin Suggested Budget: <strong style={{ color: "var(--text-primary)" }}>{prop.suggestedBudgetXlm} XLM</strong> (≈ {formatXlmToPhp(prop.suggestedBudgetXlm)})
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary tap-scale"
                            style={{ fontWeight: 800, fontSize: "0.78rem" }}
                            onClick={() => handleStartEditingProposal(prop)}
                          >
                            ✏️ Edit & Resubmit Proposal (Step 2)
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline tap-scale"
                            style={{ fontWeight: 700, fontSize: "0.78rem", color: "#d97706", borderColor: "rgba(245, 158, 11, 0.4)" }}
                            onClick={() => openRevisionModal(prop)}
                          >
                            ⚡ Quick Concurrence Modal
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline tap-scale"
                        style={{ fontSize: "0.74rem", fontWeight: 700 }}
                        onClick={() => handleOpenQuickEdit(prop)}
                      >
                        ✏️ Quick-Edit Details & Photos (Budget Locked)
                      </button>

                      {((prop.revisionHistory && prop.revisionHistory.length > 0) || isUnderRevision) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline tap-scale"
                          style={{ fontSize: "0.74rem", fontWeight: 700, color: "#6366f1", borderColor: "rgba(99, 102, 241, 0.4)" }}
                          onClick={() => setDiffModalProposal(prop)}
                        >
                          <GitCompare size={13} /> View Revision Diff ({prop.revisionHistory?.length || 1})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* 🤖 AI GOVERNANCE REVIEW MODAL (FINANCIAL AUDIT REPORT) */}
      {showAIModal && aiResult && createPortal(
        <div className="modal-overlay" onClick={() => setShowAIModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
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

            {/* In-Modal Custom AI Directive Bar */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "12px", padding: "0.65rem 0.85rem", display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.85rem" }}>
              <input
                type="text"
                className="form-control"
                placeholder='Custom prompt (e.g. "Uniforms paid by players, exclude jerseys")...'
                value={customAIPrompt}
                onChange={(e) => setCustomAIPrompt(e.target.value)}
                style={{ fontSize: "0.8rem" }}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary tap-scale"
                onClick={() => handleAskAIBuddy()}
                disabled={isAnalyzingAI}
                style={{ whiteSpace: "nowrap", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
              >
                <Bot size={13} /> {isAnalyzingAI ? "Re-Auditing..." : "Re-Analyze"}
              </button>
            </div>

            {/* Overall Feasibility Card */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <div>
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
                  Audit Verdict
                </span>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--role-accent)", marginTop: "0.1rem" }}>
                  {aiResult.verdict}
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  🤖 AI determined <strong style={{ color: "var(--text-primary)" }}>{(aiResult.recommendedPhases || []).length} Strategic Phases</strong> for this project
                </div>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text-primary)" }}>
                {aiResult.feasibilityScore}%
              </div>
            </div>

            {/* AI Suggested Title & Description Updates Card */}
            {(aiResult.improvedProjectName || aiResult.improvedDescription) && (
              <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.25)", borderRadius: "12px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#6366f1", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    ✨ AI Suggested Title & Scope Refinements
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary tap-scale"
                    style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}
                    onClick={() => {
                      if (aiResult.improvedProjectName) setProjName(aiResult.improvedProjectName);
                      if (aiResult.improvedDescription) setDescription(aiResult.improvedDescription);
                    }}
                  >
                    ✓ Adopt Title & Description
                  </button>
                </div>
                {aiResult.improvedProjectName && (
                  <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    Title: {aiResult.improvedProjectName}
                  </div>
                )}
                {aiResult.improvedDescription && (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {aiResult.improvedDescription}
                  </div>
                )}
              </div>
            )}

            {/* Budget Action & Benchmark Recommendation (Over / Under / Optimal) */}
            {(() => {
              const action = aiResult.budgetAction || "optimal";
              const isOver = action === "reduce";
              const isUnder = action === "increase";
              const isOptimal = action === "optimal";
              const declared = parseFloat(budgetXlm) || 0;
              const diffXlm = Math.abs(declared - aiResult.recommendedTotalXlm);
              
              const bg = isOver
                ? "rgba(239, 68, 68, 0.08)"
                : isUnder
                ? "rgba(245, 158, 11, 0.08)"
                : "rgba(16, 185, 129, 0.08)";
              const border = isOver
                ? "rgba(239, 68, 68, 0.25)"
                : isUnder
                ? "rgba(245, 158, 11, 0.25)"
                : "rgba(16, 185, 129, 0.25)";
              const textColor = isOver ? "#ef4444" : isUnder ? "#f59e0b" : "#10b981";

              return (
                <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: "12px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: textColor, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {isOver && "⚠️ Overbudget / Overpriced"}
                      {isUnder && "⚠️ Underfunded / Scope Exceeds Budget"}
                      {isOptimal && "✓ Fair Market Budget (Optimal)"}
                    </span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: textColor }}>
                      {isOver && `Reduce by ${diffXlm.toFixed(1)} XLM`}
                      {isUnder && `Add ${diffXlm.toFixed(1)} XLM`}
                      {isOptimal && "Stay with Declared"}
                    </span>
                  </div>
                  {aiResult.totalBudgetJustification && (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {aiResult.totalBudgetJustification}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* AI Recommended Total Budget Option */}
            {aiResult.recommendedTotalXlm > 0 && (
              <div style={{ background: "rgba(0, 214, 101, 0.08)", border: "1px solid rgba(0, 214, 101, 0.25)", borderRadius: "12px", padding: "0.75rem 0.9rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={applyAITotalBudget}
                    onChange={(e) => setApplyAITotalBudget(e.target.checked)}
                  />
                  <span>Adopt Recommended Total Budget:</span>
                </label>
                <strong style={{ color: "var(--accent-green)", fontSize: "0.95rem" }}>
                  {aiResult.recommendedTotalXlm} XLM ({formatXlmToPhp(aiResult.recommendedTotalXlm)})
                </strong>
              </div>
            )}

            {/* 🏛️ Government Agency Collaboration & Co-Funding */}
            {aiResult.partnerAgencies && aiResult.partnerAgencies.length > 0 && (
              <div style={{ background: "rgba(0, 125, 254, 0.06)", border: "1px solid rgba(0, 125, 254, 0.22)", borderRadius: "12px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: "0.35rem", textTransform: "uppercase" }}>
                  🏛️ Inter-Agency Collaboration (Borrow Free vs Buy SRP)
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {aiResult.partnerAgencies.map((agency, aIdx) => (
                    <div key={aIdx} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "0.6rem 0.75rem", fontSize: "0.76rem" }}>
                      <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "0.15rem" }}>
                        {agency.agencyName}
                      </strong>
                      {agency.borrowableItemsOrService && (
                        <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "var(--accent-green)", padding: "0.3rem 0.5rem", borderRadius: "6px", fontWeight: 800, fontSize: "0.73rem", margin: "0.25rem 0" }}>
                          📦 Items to Borrow for FREE: {agency.borrowableItemsOrService}
                        </div>
                      )}
                      <div style={{ color: "var(--role-accent)", fontWeight: 700, marginBottom: "0.15rem" }}>
                        ✓ {agency.roleOrBenefit}
                      </div>
                      <div style={{ color: "var(--text-secondary)", lineHeight: 1.35 }}>
                        {agency.recommendedAction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Tranches */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.25rem", maxHeight: "280px", overflowY: "auto", paddingRight: "0.2rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                Recommended Tranche Breakdown ({(aiResult.recommendedPhases || []).length} Phases):
              </span>
              {(aiResult.recommendedPhases || []).map((ph, idx) => {
                const isChecked = !!selectedAIPhases[idx];
                const activeTotal = applyAITotalBudget && aiResult.recommendedTotalXlm ? aiResult.recommendedTotalXlm : (parseFloat(budgetXlm) || 0);
                const phaseAmt = (activeTotal * ph.percentage) / 100;
                return (
                  <div key={idx} style={{ background: isChecked ? "var(--bg-hover)" : "var(--bg-elevated)", border: `1px solid ${isChecked ? "var(--role-accent-border)" : "var(--border-primary)"}`, borderRadius: "12px", padding: "0.75rem 0.9rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.86rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setSelectedAIPhases((prev) => ({ ...prev, [idx]: e.target.checked }))}
                        />
                        <span>{ph.title}</span>
                      </label>
                      <span className="badge badge-info" style={{ fontSize: "0.74rem", fontWeight: 800 }}>
                        {phaseAmt.toFixed(1)} XLM ({ph.percentage}%)
                      </span>
                    </div>
                    {ph.description && (
                      <p style={{ margin: "0.2rem 0 0 1.5rem", fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: "1.35" }}>
                        {ph.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="button" className="btn btn-outline tap-scale" style={{ flex: 1 }} onClick={() => setShowAIModal(false)}>
                Keep Draft
              </button>
              <button type="button" className="btn btn-primary tap-scale" style={{ flex: 1.5, fontWeight: 800 }} onClick={handleApplySelectedAIRecommendations}>
                <Sparkles size={14} /> Apply AI Structure ({(aiResult.recommendedPhases || []).length} Phases)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 📋 SK REVISION REVIEW & RESPONSE MODAL (PORTALED DIRECTLY TO BODY) */}
      {reviewingRevisionProp && createPortal(
        <div className="modal-overlay" onClick={() => setReviewingRevisionProp(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "650px" }}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                    Admin Revisions & Response
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Project: {reviewingRevisionProp.projectName}</span>
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setReviewingRevisionProp(null)}>✕</button>
            </div>

            {/* Admin Feedback Summary Card */}
            <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "14px", padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#d97706", display: "flex", alignItems: "center", gap: "0.35rem", textTransform: "uppercase" }}>
                📝 Barangay Admin Remarks & Recommendations
              </div>
              <p style={{ margin: 0, fontSize: "0.86rem", color: "#92400e", lineHeight: 1.45, fontWeight: 600 }}>
                "{reviewingRevisionProp.adminRevisionNotes || "Please review the adjusted budget and milestones."}"
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", borderTop: "1px solid rgba(245, 158, 11, 0.2)", paddingTop: "0.5rem" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Originally Proposed</span>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-secondary)" }}>
                    {reviewingRevisionProp.proposedBudgetXlm} XLM (≈ {formatXlmToPhp(reviewingRevisionProp.proposedBudgetXlm)})
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "0.72rem", color: "#d97706", textTransform: "uppercase", fontWeight: 800 }}>Admin Suggested</span>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#d97706" }}>
                    {reviewingRevisionProp.suggestedBudgetXlm || reviewingRevisionProp.proposedBudgetXlm} XLM (≈ {formatXlmToPhp(reviewingRevisionProp.suggestedBudgetXlm || reviewingRevisionProp.proposedBudgetXlm)})
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Revised Total Budget */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "14px", padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-primary)" }}>Agreed Revised Budget (XLM)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={revisionBudgetXlm}
                    onChange={(e) => {
                      const newTotal = parseFloat(e.target.value) || 0;
                      setRevisionBudgetXlm(e.target.value);
                      setRevisionPhases(prev => prev.map(p => ({
                        ...p,
                        amountXlm: (newTotal * p.percentage) / 100
                      })));
                    }}
                    style={{ fontWeight: 800 }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Peso Equivalent:</span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-green)", padding: "0.45rem 0" }}>
                    ≈ {formatXlmToPhp(parseFloat(revisionBudgetXlm) || 0)}
                  </div>
                </div>
              </div>

              {/* Tranche Milestone Editor */}
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginTop: "0.3rem" }}>
                Revised Milestone Tranches ({revisionPhases.length} Phases)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto" }}>
                {revisionPhases.map((ph, pIdx) => (
                  <div key={pIdx} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "0.6rem 0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ width: "65%" }}>
                      <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)", display: "block" }}>{ph.title}</strong>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{ph.description || "Deliverables proof required"}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="badge badge-info" style={{ fontSize: "0.72rem", fontWeight: 800 }}>
                        {ph.percentage}% ({((parseFloat(revisionBudgetXlm) || 0) * ph.percentage / 100).toFixed(1)} XLM)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SK Reply / Concurrence Remark */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-primary)", display: "block", marginBottom: "0.3rem" }}>
                💬 SK Reply / Concurrence Note for Barangay Admin
              </label>
              <textarea
                className="form-control"
                rows={2}
                placeholder='e.g. "We accept the adjusted 450 XLM budget and will borrow equipment from CDRRMO as advised."'
                value={skReplyNotes}
                onChange={(e) => setSkReplyNotes(e.target.value)}
                style={{ fontSize: "0.82rem" }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-outline tap-scale" style={{ flex: 1 }} onClick={() => setReviewingRevisionProp(null)} disabled={isSubmittingRevision}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-outline-primary tap-scale"
                style={{ flex: 1.3, fontWeight: 700 }}
                onClick={() => handleCounterPropose(reviewingRevisionProp)}
                disabled={isSubmittingRevision}
              >
                🚀 Counter-Propose
              </button>
              <button
                type="button"
                className="btn btn-primary tap-scale"
                style={{ flex: 1.5, fontWeight: 800 }}
                onClick={() => handleAcceptAdminRevisions(reviewingRevisionProp)}
                disabled={isSubmittingRevision}
              >
                ✓ Accept & Resubmit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ✏️ QUICK-EDIT PROJECT DETAILS & PHOTOS MODAL (BUDGET LOCKED) */}
      {quickEditProp && createPortal(
        <div className="modal-overlay" onClick={() => setQuickEditProp(null)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "720px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="bottom-sheet-handle" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Quick-Edit Project Details & Photos
                </h3>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                  Update narrative, images, and milestones without modifying locked financial budget
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setQuickEditProp(null)}>✕</button>
            </div>

            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Locked Budget Callout */}
              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "10px", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Lock size={15} style={{ color: "var(--accent-green)" }} />
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Total Approved / Proposed Budget
                  </span>
                </div>
                <strong style={{ fontSize: "1rem", color: "var(--accent-green)" }}>
                  {quickEditProp.proposedBudgetXlm} XLM (Locked)
                </strong>
              </div>

              {/* Title */}
              <div className="form-group">
                <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Project Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={quickEditName}
                  onChange={(e) => setQuickEditName(e.target.value)}
                  placeholder="Project Initiative Title"
                  required
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Description & Scope</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={quickEditDesc}
                  onChange={(e) => setQuickEditDesc(e.target.value)}
                  placeholder="Project scope and community impact..."
                  required
                />
              </div>

              {/* Photos & Mockups Manager */}
              <div className="form-group">
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  <span>Project Photos & Mockups ({quickEditImages.length})</span>
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    placeholder="Paste Image URL..."
                    value={quickEditNewImg}
                    onChange={(e) => setQuickEditNewImg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (quickEditNewImg.trim()) {
                          setQuickEditImages([...quickEditImages, quickEditNewImg.trim()]);
                          setQuickEditNewImg("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline tap-scale"
                    onClick={() => {
                      if (quickEditNewImg.trim()) {
                        setQuickEditImages([...quickEditImages, quickEditNewImg.trim()]);
                        setQuickEditNewImg("");
                      }
                    }}
                  >
                    + Add
                  </button>
                </div>

                {quickEditImages.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {quickEditImages.map((url, imgIdx) => (
                      <div key={imgIdx} style={{ position: "relative", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-subtle)", height: "65px" }}>
                        <img src={url} alt={`Project ${imgIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as any).src = "https://placehold.co/100x65?text=Image"; }} />
                        <button
                          type="button"
                          style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                          onClick={() => setQuickEditImages(quickEditImages.filter((_, i) => i !== imgIdx))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Milestone Details & Target Dates Quick-Edit */}
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
                  Milestone Deliverables & Target Dates
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {quickEditPhases.map((ph, pIdx) => (
                    <div key={pIdx} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "10px", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "0.84rem", color: "var(--text-primary)" }}>
                          {ph.title?.toLowerCase().startsWith(`phase ${ph.phaseNumber || pIdx + 1}:`) ||
                          ph.title?.toLowerCase().startsWith(`phase ${ph.phaseNumber || pIdx + 1} -`) ||
                          ph.title?.toLowerCase().startsWith(`phase ${ph.phaseNumber || pIdx + 1} `)
                            ? ph.title
                            : `Phase ${ph.phaseNumber || pIdx + 1}: ${ph.title}`}
                        </strong>
                        <span className="badge badge-info" style={{ fontSize: "0.7rem" }}>{ph.percentage}%</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        <div>
                          <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>Target Date</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Sept 19, 2026"
                            value={ph.targetDate || ""}
                            onChange={(e) => {
                              const updated = [...quickEditPhases];
                              updated[pIdx].targetDate = e.target.value;
                              setQuickEditPhases(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>Required Proofs</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Geo-tagged photos"
                            value={ph.requiredProofs || ""}
                            onChange={(e) => {
                              const updated = [...quickEditPhases];
                              updated[pIdx].requiredProofs = e.target.value;
                              setQuickEditPhases(updated);
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>Deliverables Scope</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          placeholder="Scope of work..."
                          value={ph.description || ""}
                          onChange={(e) => {
                            const updated = [...quickEditPhases];
                            updated[pIdx].description = e.target.value;
                            setQuickEditPhases(updated);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
              <button type="button" className="btn btn-outline tap-scale" style={{ flex: 1 }} onClick={() => setQuickEditProp(null)} disabled={isSavingQuickEdit}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary tap-scale" style={{ flex: 1.5, fontWeight: 800 }} onClick={handleSaveQuickEdit} disabled={isSavingQuickEdit || !quickEditName.trim()}>
                {isSavingQuickEdit ? "Saving..." : "✓ Save & Notify Admin"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🎨 AI IMAGE REIMAGINE MODAL */}
      {showReimagineModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowReimagineModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="bottom-sheet-handle" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Wand2 size={18} style={{ color: "var(--role-accent)" }} />
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900, color: "var(--text-primary)" }}>
                  🎨 Reimagine Project Poster with AI
                </h4>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowReimagineModal(false)}
                style={{ borderRadius: "50%", width: "28px", height: "28px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Describe how you'd like your project visual to look (e.g. <em>"Championship golden basketball trophy with glowing neon lights"</em> or <em>"Modern solar streetlights illuminating barangay road"</em>).
            </p>

            <textarea
              className="form-control"
              rows={3}
              placeholder="Enter your visual imagination prompt..."
              value={reimaginePrompt}
              onChange={(e) => setReimaginePrompt(e.target.value)}
              style={{ marginBottom: "0.75rem" }}
            />

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-outline tap-scale"
                style={{ flex: 1 }}
                onClick={() => setShowReimagineModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary tap-scale"
                style={{ flex: 1.5, fontWeight: 800 }}
                onClick={async () => {
                  const currentPrompt = reimaginePrompt;
                  setShowReimagineModal(false);
                  setReimaginePrompt("");

                  startLoading({
                    category: "ai",
                    title: "🎨 AI Generative Studio",
                    message: "Synthesizing cinematic 4K community project highlight visual...",
                    steps: ["Analyzing Proposal Scope & Context", "Synthesizing 4K Highlight Visual"],
                  });

                  try {
                    const newImg = aiImageGenerator.generateReimaginedImage(currentPrompt, {
                      title: projName,
                      description: description,
                      phases: phases,
                    });

                    updateLoading("Rendering photorealistic visuals and embedding proposal context...", 1);
                    
                    // Preload the image so the user sees it immediately when loader closes
                    await new Promise<void>((resolve) => {
                      const img = new Image();
                      img.onload = () => resolve();
                      img.onerror = () => resolve();
                      img.src = newImg;
                      setTimeout(resolve, 2500); // 2.5s safe render window
                    });

                    updateLoading("AI Poster ready!", 2);
                    setImageUrls([newImg, ...imageUrls]);
                  } catch (err) {
                    console.error("AI Reimagine error:", err);
                  } finally {
                    stopLoading();
                  }
                }}
              >
                ✨ Generate AI Poster
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 📊 REVISION DIFF & COMPARISON MODAL */}
      {diffModalProposal && (
        <RevisionDiffModal
          proposal={diffModalProposal}
          onClose={() => setDiffModalProposal(null)}
        />
      )}
    </div>
  );
};

export default SKWorkspace;
