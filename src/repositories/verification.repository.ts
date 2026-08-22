import { doc } from "firebase/firestore";
import { db } from "../services/firebase";
import { dbSetDoc, dbUpdateDoc, dbDeleteDoc } from "./db.helper";

export interface UploadedDocumentEntry {
  uid: string;
  documentType: string;
  storagePath: string;
  base64Url: string;
  hash: string;
  uploadedAt: string;
}

export interface AIVerificationEntry {
  userId: string;
  version: string;
  timestamp: string;
  createdAt: string;
  documentType: string;
  confidence: number;
  imageQuality: any;
  extractedFields: any;
  fieldMatches: any;
  riskScore: number;
  recommendation: string;
  reasons: string[];
  explanation: string;
  decision?: string;
  scores?: any;
  duplicateRisk: boolean;
  status: string;
}

export interface BarangayAdminRequestEntry {
  uid: string;
  barangayId: string;
  status: "pending" | "approved" | "rejected" | "resubmission_required";
  submittedAt: string;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  reviewOutcome?: string;
  resubmissionPreset?: string;
  resubmissionFields?: string[];
  resubmissionReason?: string;
  resubmissionSuggestedReason?: string;
}

export interface ResidentVerificationQueueEntry {
  uid: string;
  barangayId: string;
  status: "pending" | "approved" | "rejected" | "resubmission_required";
  submittedAt: string;
  aiRisk: string;
  duplicate: boolean;
  reviewOutcome?: string;
  resubmissionPreset?: string;
  resubmissionFields?: string[];
  resubmissionReason?: string;
  resubmissionSuggestedReason?: string;
}

export interface DuplicateReportEntry {
  userId: string;
  matchedUser: string;
  reason: string;
  similarity: number;
  status: "pending" | "reviewed" | "dismissed";
}

export const verificationRepository = {
  // Uploaded Documents
  async createUploadedDocument(id: string, entry: UploadedDocumentEntry): Promise<void> {
    const docRef = doc(db, "uploaded_documents", id);
    await dbSetDoc(docRef, entry);
  },

  async deleteUploadedDocument(id: string): Promise<void> {
    const docRef = doc(db, "uploaded_documents", id);
    await dbDeleteDoc(docRef);
  },

  // AI Verifications
  async createAIVerification(id: string, entry: AIVerificationEntry): Promise<void> {
    const docRef = doc(db, "ai_verifications", id);
    await dbSetDoc(docRef, entry);
  },

  // Barangay Admin Requests
  async createBarangayAdminRequest(uid: string, entry: BarangayAdminRequestEntry): Promise<void> {
    const docRef = doc(db, "barangay_admin_requests", uid);
    await dbSetDoc(docRef, entry);
  },

  async updateBarangayAdminRequest(uid: string, updates: Partial<BarangayAdminRequestEntry>): Promise<void> {
    const docRef = doc(db, "barangay_admin_requests", uid);
    await dbUpdateDoc(docRef, updates);
  },

  // Resident Verification Queue
  async createResidentVerificationQueueEntry(uid: string, entry: ResidentVerificationQueueEntry): Promise<void> {
    const docRef = doc(db, "resident_verification_queue", uid);
    await dbSetDoc(docRef, entry);
  },

  async updateResidentVerificationQueueEntry(uid: string, updates: Partial<ResidentVerificationQueueEntry>): Promise<void> {
    const docRef = doc(db, "resident_verification_queue", uid);
    await dbUpdateDoc(docRef, updates);
  },

  // Duplicate Reports
  async createDuplicateReport(id: string, entry: DuplicateReportEntry): Promise<void> {
    const docRef = doc(db, "duplicate_reports", id);
    await dbSetDoc(docRef, entry);
  }
};
