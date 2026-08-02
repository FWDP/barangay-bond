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

export interface Project {
  id: number;
  name: string;
  description: string;
  budget: string; // Represented as decimal string (e.g. "400.0000000" XLM)
  creator: string;
  milestone1Proof: string;
  milestone1VotesApprove: number;
  milestone1VotesReject: number;
  milestone1Status: number; // 0 = PendingProof, 1 = PendingApproval, 2 = Approved, 3 = Rejected
  milestone2Proof: string;
  milestone2VotesApprove: number;
  milestone2VotesReject: number;
  milestone2Status: number; // 0 = PendingProof, 1 = PendingApproval, 2 = Approved, 3 = Rejected
  status: number; // 0 = Phase1Released, 1 = Milestone1ProofUploaded, 2 = Milestone1Approved (Completed)
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
