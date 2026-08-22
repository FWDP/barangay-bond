import type { UserProfile } from "../types/domain.types";

export type LifecyclePhase =
  | "PENDING_EMAIL_VERIFICATION"
  | "PENDING_REVIEW"
  | "RESUBMISSION_REQUIRED"
  | "AUTO_REJECTED"
  | "REJECTED"
  | "ACTIVE"
  | "SUSPENDED"
  | "ONBOARDING"
  | "UNKNOWN";

export function deriveLifecyclePhase(profile: UserProfile | null | undefined, emailVerified?: boolean): LifecyclePhase {
  if (!profile) return "UNKNOWN";

  if (profile.status === "suspended") {
    return "SUSPENDED";
  }

  // Explicit admin approval takes absolute precedence over historical automated AI flags
  if ((profile.verificationStatus as string) === "approved" || profile.reviewOutcome === "approved" || (profile.status === "active" && profile.verified === true)) {
    if (profile.status === "pending_email_verification" || (emailVerified === false && profile.emailVerified === false)) {
      return "PENDING_EMAIL_VERIFICATION";
    }
    return "ACTIVE";
  }

  // Resubmission check
  const isResubmissionRequired =
    profile.reviewOutcome === "resubmission_required" ||
    ((profile.resubmissionFields?.length || 0) > 0 && profile.status === "inactive");

  if (isResubmissionRequired) {
    return "RESUBMISSION_REQUIRED";
  }

  // Rejected / Auto rejected checks
  const isDuplicateAutoReject = (profile.verificationStatus === "auto_rejected" || profile.aiDecision === "auto_reject") && (profile.verificationStatus as string) !== "approved";
  const isHardRejected =
    profile.reviewOutcome === "rejected" ||
    isDuplicateAutoReject ||
    (profile.status === "inactive" && !isResubmissionRequired);

  if (isHardRejected) {
    if (isDuplicateAutoReject) {
      return "AUTO_REJECTED";
    }
    return "REJECTED";
  }

  // Pending activation / email verification
  if (profile.status === "pending_email_verification" || (emailVerified === false && profile.emailVerified === false)) {
    return "PENDING_EMAIL_VERIFICATION";
  }

  if (profile.status === "pending" || profile.verificationStatus === "pending") {
    return "PENDING_REVIEW";
  }

  if (profile.status === "active") {
    return "ACTIVE";
  }

  if (profile.status === "onboarding") {
    return "ONBOARDING";
  }

  return "UNKNOWN";
}
