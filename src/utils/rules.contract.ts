export const BLOCKED_OWNER_FIELDS = [
  "role",
  "requestedRole",
  "status",
  "position",
  "permissions",
  "verified",
  "verificationStatus",
  "verificationNotes",
  "verifiedBy",
  "verifiedAt",
  "barangayId",
  "barangayName",
  "barangayMunicipality",
  "barangayProvince",
  "currentlyReviewedBy",
  "reviewStartedAt",
  "approvedBy",
  "approvedAt",
  "termStart",
  "termEnd",
  "reviewOutcome",
  "resubmissionFields",
  "resubmissionReason",
  "resubmissionSuggestedReason",
  "lastDecisionBy",
  "lastDecisionAt"
];

/**
 * Validates whether an owner update contains any fields blocked by Firestore security rules.
 * Returns an array of blocked keys that were attempted to be updated.
 */
export function validateOwnerUpdatePayload(updates: Record<string, any>): string[] {
  const keys = Object.keys(updates);
  return keys.filter(key => BLOCKED_OWNER_FIELDS.includes(key));
}
