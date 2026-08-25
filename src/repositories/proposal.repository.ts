import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { STELLAR_CONFIG } from "../configuration/config";
import type { ProjectProposal } from "../types";

const COLLECTION_NAME = "project_proposals";

export const proposalRepository = {
  /**
   * Submit a new project proposal by an SK Official
   */
  async createProposal(proposal: Omit<ProjectProposal, "id" | "status" | "createdAt">): Promise<string> {
    const payload: Omit<ProjectProposal, "id"> = {
      ...proposal,
      status: "pending_admin_approval",
      createdAt: new Date().toISOString(),
      contractId: STELLAR_CONFIG.contractId,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    return docRef.id;
  },

  /**
   * General purpose partial update for a proposal document
   */
  async updateProposal(proposalId: string, updates: Partial<ProjectProposal>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, proposalId);
    await updateDoc(docRef, {
      ...updates,
      lastEditedAt: new Date().toISOString(),
    });
  },

  /**
   * Real-time listener for proposals in a specific Barangay
   */
  subscribeToProposals(
    barangayId: string,
    onUpdate: (proposals: ProjectProposal[]) => void
  ): () => void {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("barangayId", "==", barangayId)
    );

    return onSnapshot(q, (snapshot) => {
      const proposals: ProjectProposal[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ProjectProposal, "id">),
        }))
        // Filter strictly to current active contract ID (or unassigned/pending approval)
        .filter((p) => !p.contractId || p.contractId === STELLAR_CONFIG.contractId);

      // Sort by createdAt descending
      proposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(proposals);
    });
  },

  /**
   * Real-time listener for all proposals nationwide across all Barangays
   */
  subscribeToAllProposals(
    onUpdate: (proposals: ProjectProposal[]) => void
  ): () => void {
    const q = query(collection(db, COLLECTION_NAME));

    return onSnapshot(q, (snapshot) => {
      const proposals: ProjectProposal[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ProjectProposal, "id">),
        }))
        .filter((p) => !p.contractId || p.contractId === STELLAR_CONFIG.contractId);

      proposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(proposals);
    });
  },

  /**
   * Update proposal status after Barangay Admin approval, rejection, or revision request
   */
  async updateProposalStatus(
    proposalId: string,
    status: "approved_onchain" | "rejected" | "revision_requested" | "pending_admin_approval",
    adminUid: string,
    updates?: { 
      projectName?: string;
      description?: string;
      imageUrls?: string[];
      approvedBudgetXlm?: number; 
      approvedMobilizationPct?: number; 
      suggestedBudgetXlm?: number;
      suggestedPhases?: any[];
      proposedBudgetXlm?: number;
      adminRevisionNotes?: string;
      skCounterNotes?: string;
      revisionHistory?: any[];
      onChainProjectId?: number; 
      txHash?: string;
      phaseProofRequirements?: Record<string, string>;
      phase1Policy?: "immediate" | "feasibility_vote";
      phases?: any[];
      contractId?: string;
      lastEditedAt?: string;
      lastEditedByName?: string;
      lastEditedByRole?: string;
      lastEditedByUid?: string;
    }
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, proposalId);
    await updateDoc(docRef, {
      status,
      reviewedByAdminUid: adminUid,
      contractId: updates?.contractId || STELLAR_CONFIG.contractId,
      ...(updates || {}),
    });
  },

  /**
   * Submit a private additional proof for a specific milestone
   */
  async submitAdditionalProof(
    proposalId: string,
    milestoneIndex: number,
    proofUrl: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, proposalId);
    await updateDoc(docRef, {
      [`additionalProofs.milestone_${milestoneIndex}`]: proofUrl,
    });
  },

  /**
   * Re-edit project text details and images (Budget is strictly locked)
   */
  async updateProjectDetails(
    proposalId: string,
    updates: {
      projectName?: string;
      description?: string;
      imageUrls?: string[];
      phases?: any[];
      lastEditedBy?: string;
      lastEditedAt?: string;
      lastEditedByName?: string;
      lastEditedByRole?: string;
      lastEditedByUid?: string;
    }
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, proposalId);
    await updateDoc(docRef, {
      ...updates,
      lastEditedAt: updates.lastEditedAt || new Date().toISOString(),
    });
  },
};
