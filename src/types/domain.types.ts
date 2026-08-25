import type { ResubmissionFieldKey, ResubmissionPresetKey } from "../utils/reviewDecision";

export type AccountRole = "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer";

export type RegistrationStatus =
  | "active"
  | "inactive"
  | "suspended"
  | "expired"
  | "pending"
  | "pending_email_verification"
  | "onboarding";

export type VerificationStatus = "pending" | "approved" | "rejected" | "auto_rejected" | "ai_verified";

export type ReviewDecision = "approved" | "rejected" | "resubmission_required";

export interface UserProfile {
  uid: string;
  email: string;
  name: string; // display name compatibility
  firstName: string;
  middleName: string;
  lastName: string;
  suffix?: string;
  displayName: string;
  birthdate: string;
  age: number;
  barangayId: string;
  barangayName: string;
  barangayMunicipality: string;
  barangayProvince: string;
  role: AccountRole;
  requestedRole: "barangay_admin" | "resident" | "system_admin";
  status: RegistrationStatus;
  position: "chairman" | "kagawad" | "secretary" | "treasurer" | "none";
  skPosition?: "chairman" | "kagawad" | "secretary" | "treasurer" | "none";
  lastActiveAt?: string;
  permissions: string[];
  walletAddress: string | null;
  walletProvider: string | null;
  walletVerified: boolean;
  walletLinkedAt: string | null;
  inAppWalletSecret?: string | null;
  isInAppWallet?: boolean;
  verified: boolean;
  verificationStatus: VerificationStatus;
  reviewOutcome?: ReviewDecision;
  resubmissionPreset?: ResubmissionPresetKey;
  resubmissionFields?: ResubmissionFieldKey[];
  resubmissionReason?: string;
  resubmissionSuggestedReason?: string;
  lastDecisionBy?: string | null;
  lastDecisionAt?: string | null;
  createdAt: string;
  updatedAt: string;
  mobileNumber: string;
  address: string;
  idType: string;
  idNumber: string;
  schoolName: string;
  idPhotoUrl: string;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  currentlyReviewedBy?: string | null;
  reviewStartedAt?: string | null;
  termStart?: string;
  termEnd?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  riskScore?: number;
  duplicateScore?: number;
  aiDecision?: "auto_accept" | "auto_reject" | "manual_review" | "none" | "approved";
  aiFlagged?: boolean;
  requiresManualReview?: boolean;
  imageQualitySummary?: string;
  latestVerificationId?: string;
  autoRejectReason?: string;
  selfiePhotoUrl?: string;
  professionalInfo?: string;
  adminReason?: string;
  profilePhotoUrl?: string;
  photoURL?: string;
  lastLogin?: string;
  emailVerified?: boolean;
  activationStatus?: "pending_email_verification" | "active" | "inactive";
  verificationEmailSentAt?: string | null;
  activatedAt?: string | null;
  aiVerificationId?: string;
  duplicateRisk?: boolean;
  studentNumber?: string;
  decision?: string;
  scores?: any;
  requestedBarangayId?: string;
  requestedBarangayName?: string;
  requestedProvinceName?: string;
  requestedMunicipalityName?: string;
  requestedRegionName?: string;
  barangayRegion?: string;
  acknowledgedPromotion?: boolean;
  skHistory?: SKTermRecord[];
}

export interface SKTermRecord {
  position: "chairman" | "kagawad" | "secretary" | "treasurer" | "none";
  termStart: string;
  termEnd: string;
  assignedAt: string;
  revokedAt?: string;
  barangayId: string;
  barangayName?: string;
  assignedByAdminUid?: string;
  assignedByAdminName?: string;
}

export interface Barangay {
  id: string;
  name: string;
  municipality: string;
  province: string;
  status: "pending" | "approved" | "inactive" | "suspended" | "archived";
  createdAt: string;
  approvedAt: string | null;
  adminsCount: number;
  residentsCount: number;
  projectsCount: number;
  createdBy?: string;
  approvedBy?: string;
  active?: boolean;
  barangayId?: string;
  barangayName?: string;
  municipalityName?: string;
  provinceName?: string;
  regionName?: string;
  psgcCode?: string;
  zipCode?: string;
  assignedBarangayAdminUid?: string | null;
}
