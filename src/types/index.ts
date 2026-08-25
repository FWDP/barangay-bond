export type TransactionStatus =
  | "Idle"
  | "Pending"
  | "Submitted"
  | "Confirmed"
  | "Failed"
  | "Rejected"
  | "Expired"
  | "SimulationError"
  | "NetworkError"
  | "WalletCancelled";

export interface Milestone {
  index: number;
  percentage: number;
  proofUrl: string;
  publicProofUrls?: string[];
  adminProofUrls?: string[];
  votesApprove: number;
  votesReject: number;
  status: number; // 0 = PendingProof, 1 = PendingApproval, 2 = Approved, 3 = Rejected
}

export interface Project {
  id: number;
  name: string;
  description: string;
  budget: string; // Represented as decimal string (e.g. "400.0000000" XLM)
  creator: string;
  totalPhases: number;
  currentPhase: number;
  status: number; // 0 = Active, 1 = Completed, 2 = Refunded
  milestones?: Milestone[];
  contractId?: string;
  // Backwards compatibility / computed properties if needed
  mobilizationPct?: number;
  milestone1Proof?: string;
  milestone1VotesApprove?: number;
  milestone1VotesReject?: number;
  milestone1Status?: number;
}

export interface ProjectPhase {
  phaseNumber: number;
  title: string;
  percentage: number;
  amountXlm: number;
  description?: string;
  requiredProofs?: string;
  targetDate?: string;
  adminOnlyProofRequired?: boolean;
  adminProofDescription?: string;
  publicProofRequired?: boolean;
}

export interface ProposalRevisionEntry {
  author: "admin" | "sk";
  authorName: string;
  authorRole?: string;
  notes: string;
  timestamp: string;
  budgetXlm: number;
  projectName?: string;
  description?: string;
  imageUrls?: string[];
  phases?: ProjectPhase[];
  lastEditedByName?: string;
  lastEditedByRole?: string;
}

export interface ProjectProposal {
  id?: string;
  barangayId: string;
  barangayName?: string;
  skOfficialUid: string;
  skOfficialAddress: string;
  skOfficialName: string;
  projectName: string;
  proposedBudgetXlm: number;
  approvedBudgetXlm?: number;
  suggestedBudgetXlm?: number;
  proposedMobilizationPct?: number;
  approvedMobilizationPct?: number;
  phases?: ProjectPhase[];
  suggestedPhases?: ProjectPhase[];
  description: string;
  imageUrls?: string[];
  status: "pending_admin_approval" | "revision_requested" | "approved_onchain" | "rejected";
  createdAt: string;
  lastEditedAt?: string;
  lastEditedBy?: string;
  lastEditedByName?: string;
  lastEditedByRole?: string;
  lastEditedByUid?: string;
  contractId?: string;
  reviewedByAdminUid?: string;
  onChainProjectId?: number;
  txHash?: string;
  phaseProofRequirements?: Record<string, string>;
  additionalProofs?: Record<string, string>;
  publicProofUrls?: Record<string, string[]>;
  adminProofUrls?: Record<string, string[]>;
  phase1Policy?: "immediate" | "feasibility_vote";
  adminRevisionNotes?: string;
  skCounterNotes?: string;
  revisionHistory?: ProposalRevisionEntry[];
}

export interface UserRoles {
  isAdmin: boolean;
  isSKOfficial: boolean;
  isYouth: boolean;
}

export interface EventLog {
  id: string;
  type: "resident" | "sk_offic" | "proj_new" | "proof_up" | "vote" | "proj_done" | "proj_rej" | "unknown";
  timestamp: string;
  txHash: string;
  details: string;
}
