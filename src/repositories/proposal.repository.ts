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
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    return docRef.id;
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
      const proposals: ProjectProposal[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ProjectProposal, "id">),
      }));

      // Sort by createdAt descending
      proposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(proposals);
    });
  },

  /**
   * Update proposal status after Barangay Admin approval or rejection
   */
  async updateProposalStatus(
    proposalId: string,
    status: "approved_onchain" | "rejected",
    adminUid: string,
    updates?: { 
      approvedBudgetXlm?: number; 
      approvedMobilizationPct?: number; 
      onChainProjectId?: number; 
      txHash?: string;
      phaseProofRequirements?: Record<string, string>;
      phases?: any[];
    }
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, proposalId);
    await updateDoc(docRef, {
      status,
      reviewedByAdminUid: adminUid,
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
};
