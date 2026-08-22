import { increment } from "firebase/firestore";
import { userRepository } from "../repositories/user.repository";
import { barangayRepository } from "../repositories/barangay.repository";
import { auditRepository, type AuditLogEntry } from "../repositories/audit.repository";
import { notificationRepository, type NotificationEntry } from "../repositories/notification.repository";
import { verificationRepository } from "../repositories/verification.repository";
import { emailService } from "./email.service";
import { logger } from "../utils/logger";
import type { UserProfile } from "../types/domain.types";
import { inferResubmissionFields, inferResubmissionPreset, getResubmissionFieldsForPreset, getResubmissionSuggestedReasonForPreset } from "../utils/reviewDecision";
import type { ResubmissionFieldKey, ResubmissionPresetKey } from "../utils/reviewDecision";

export const adminService = {
  async verifyUserInDb(
    adminProfile: UserProfile,
    targetUid: string,
    role: "sk" | "youth",
    isVerify: boolean,
    notes: string,
    decision?: {
      action?: "full_reject" | "resubmission_required";
      preset?: ResubmissionPresetKey;
      resubmissionFields?: ResubmissionFieldKey[];
      suggestedReason?: string;
    }
  ): Promise<void> {
    logger.debug(`[adminService] verifyUserInDb initiated for target: ${targetUid}, verify: ${isVerify}`, "AdminService");

    if (!adminProfile || (adminProfile.role !== "barangay_admin" && adminProfile.role !== "system_admin")) {
      throw new Error("Only Barangay Admin or System Admin can verify users");
    }

    const targetData = await userRepository.getUserProfile(targetUid);
    if (!targetData) throw new Error("Resident not found");

    if (adminProfile.role === "barangay_admin" && targetData.barangayId !== adminProfile.barangayId) {
      throw new Error("Cannot verify resident outside your assigned Barangay");
    }

    const isApplyingForAdmin = targetData.requestedRole === "barangay_admin" ||
      targetData.requestedRole === "system_admin" ||
      targetData.role === "barangay_admin" ||
      targetData.role === "system_admin";

    const targetRoleName = role === "sk" ? "sk_official" : "resident";
    const reviewAction = isVerify ? "approve" : (decision?.action || "full_reject");
    const isResubmissionRequested = !isVerify && reviewAction === "resubmission_required";
    const resubmissionPreset = isResubmissionRequested ? (decision?.preset || inferResubmissionPreset(notes)) : "full_package";
    const resubmissionFields = isResubmissionRequested
      ? (decision?.resubmissionFields || getResubmissionFieldsForPreset(resubmissionPreset, inferResubmissionFields(notes)))
      : [];
    const suggestedReason = isResubmissionRequested
      ? (decision?.suggestedReason || getResubmissionSuggestedReasonForPreset(resubmissionPreset, resubmissionFields))
      : "";

    logger.info(`[adminService] Review decision resolved: isVerify=${isVerify}, action=${reviewAction}, isResubmissionRequested=${isResubmissionRequested}, preset=${resubmissionPreset}, flaggedFields=${JSON.stringify(resubmissionFields)}`, "AdminService");

    const updates = {
      verified: isVerify,
      verificationStatus: isVerify ? ("approved" as const) : ("rejected" as const),
      reviewOutcome: isVerify ? ("approved" as const) : (isResubmissionRequested ? ("resubmission_required" as const) : ("rejected" as const)),
      resubmissionPreset,
      role: isVerify
        ? (targetRoleName as any)
        : (isApplyingForAdmin ? ("viewer" as any) : ("resident" as any)),
      status: isVerify
        ? (targetData.emailVerified ? ("active" as const) : ("pending_email_verification" as const))
        : (isApplyingForAdmin ? ("active" as const) : ("inactive" as const)),
      activationStatus: isVerify
        ? (targetData.emailVerified ? ("active" as const) : ("pending_email_verification" as const))
        : (isApplyingForAdmin ? ("active" as const) : ("inactive" as const)),
      emailVerified: targetData.emailVerified || false,
      approvedAt: isVerify ? new Date().toISOString() : null,
      approvedBy: isVerify ? adminProfile.uid : null,
      verificationEmailSentAt: null,
      activatedAt: isVerify && targetData.emailVerified ? new Date().toISOString() : null,
      verificationNotes: notes,
      verifiedBy: adminProfile.email || "admin",
      verifiedAt: new Date().toISOString(),
      currentlyReviewedBy: null,
      reviewStartedAt: null,
      lastDecisionBy: adminProfile.uid,
      lastDecisionAt: new Date().toISOString(),
      resubmissionFields,
      resubmissionReason: isVerify ? "" : notes,
      resubmissionSuggestedReason: suggestedReason,
      autoRejectReason: isVerify ? "" : (isResubmissionRequested ? suggestedReason || notes : notes),
      aiDecision: isVerify ? ("approved" as const) : (targetData.aiDecision || ("none" as const)),
      aiFlagged: isVerify ? false : (targetData.aiFlagged || false)
    };

    logger.database(`[adminService] Updating target user profile document in Firestore: users/${targetUid}`, "AdminService");
    await userRepository.updateUserProfile(targetUid, updates);

    if (isApplyingForAdmin) {
      logger.database(`[adminService] Updating Barangay Admin application status queue in Firestore for target: ${targetUid}`, "AdminService");
      try {
        await verificationRepository.updateBarangayAdminRequest(targetUid, {
          status: isVerify ? "approved" : (isResubmissionRequested ? "resubmission_required" : "rejected"),
          approvedBy: isVerify ? adminProfile.uid : null,
          rejectedBy: isVerify ? null : adminProfile.uid,
          reviewOutcome: updates.reviewOutcome,
          resubmissionPreset,
          resubmissionFields,
          resubmissionReason: updates.resubmissionReason,
          resubmissionSuggestedReason: suggestedReason
        });
      } catch (e: any) {
        logger.error(`[adminService] Failed to update barangay_admin_requests: ${e.message}`, "AdminService");
      }
    } else {
      logger.database(`[adminService] Updating Resident verification status queue in Firestore for target: ${targetUid}`, "AdminService");
      await verificationRepository.updateResidentVerificationQueueEntry(targetUid, {
        status: isVerify ? "approved" : (isResubmissionRequested ? "resubmission_required" : "rejected"),
        reviewOutcome: updates.reviewOutcome,
        resubmissionPreset,
        resubmissionFields,
        resubmissionReason: updates.resubmissionReason,
        resubmissionSuggestedReason: suggestedReason
      });
    }

    if (isVerify && !isApplyingForAdmin && targetData.barangayId && targetData.barangayId !== "unassigned" && targetData.barangayId !== "N/A" && targetData.barangayId.trim() !== "") {
      logger.database(`[adminService] Incrementing residents count for Barangay: ${targetData.barangayId}`, "AdminService");
      await barangayRepository.updateBarangay(targetData.barangayId, {
        residentsCount: increment(1)
      });
    }

    const actionName = isVerify
      ? (isApplyingForAdmin ? "barangay_admin_approved" : "resident_approved")
      : (isApplyingForAdmin ? "barangay_admin_rejected" : "resident_rejected");

    const auditEntry: AuditLogEntry = {
      action: actionName,
      category: "Verification",
      severity: isVerify ? "Info" : "Warning",
      actorUid: adminProfile.uid,
      actorName: adminProfile.name,
      actorRole: adminProfile.role,
      targetUid: targetUid,
      targetName: targetData.name,
      targetRole: isVerify ? (isApplyingForAdmin ? "barangay_admin" : targetRoleName) : (isApplyingForAdmin ? "viewer" : "resident"),
      barangayId: targetData.barangayId || adminProfile.barangayId || "N/A",
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: isVerify
        ? (isApplyingForAdmin ? `Assigned as admin. Remarks: ${notes}` : `Residency verified. Remarks: ${notes}`)
        : (isApplyingForAdmin ? `Admin application rejected. Reverted to Viewer. Reason: ${notes}` : `Verification rejected. Reason: ${notes}`),
      metadata: {
        targetMobile: targetData.mobileNumber || "N/A",
        decision: isVerify ? "approve" : "reject",
        actorUid: adminProfile.uid,
        actorName: adminProfile.name || adminProfile.displayName || adminProfile.email || "Unknown",
        reason: notes,
        targetStatusBefore: targetData.verificationStatus || "unknown",
        targetRoleBefore: targetData.role || "resident"
      }
    };
    logger.database(`[adminService] Writing audit log in Firestore: audit_logs`, "AdminService");
    await auditRepository.writeAuditLog(auditEntry);

    const notifEntry: NotificationEntry = {
      barangayId: targetData.barangayId || adminProfile.barangayId || "N/A",
      targetUid: targetUid,
      title: isVerify
        ? (isApplyingForAdmin ? "Barangay Admin Approved" : "Account Verified")
        : (isApplyingForAdmin ? "Barangay Admin Application Rejected" : "Verification Rejected"),
      message: isVerify
        ? (isApplyingForAdmin
          ? "Your application has been approved. You are now the assigned admin."
          : "Your Barangay residency profile has been verified. You can now connect your wallet and audit local projects.")
        : (isApplyingForAdmin
          ? `Your application for Barangay Admin was rejected. Reason: ${notes}. You have been reverted to Viewer mode.`
          : `Your verification request was rejected. Notes: ${notes}`),
      createdAt: new Date().toISOString(),
      read: false
    };
    logger.database(`[adminService] Sending verification outcome notification to users/${targetUid}`, "AdminService");
    await notificationRepository.createNotification(notifEntry);

    logger.info(`[adminService] Triggering email alert to ${targetData.email} (type: ${isVerify ? "approved" : "rejected"})`, "AdminService");
    if (isVerify) {
      await emailService.triggerLifecycleEmail("approved", targetData.email, { name: targetData.name });
    } else {
      await emailService.triggerLifecycleEmail("rejected", targetData.email, { name: targetData.name, reason: notes });
    }
    logger.success(`[adminService] verifyUserInDb completed successfully for target ${targetUid}`, "AdminService");
  },

  async approveBarangayAdmin(
    adminProfile: UserProfile,
    adminUid: string,
    barangayId: string,
    barangayName: string,
    municipalityName?: string,
    provinceName?: string,
    regionName?: string,
    zipCode?: string
  ): Promise<void> {
    if (!adminProfile || (adminProfile.role !== "system_admin" && adminProfile.role !== "barangay_admin")) {
      throw new Error("Only System Admin or an existing Barangay Admin can approve Barangay Admins");
    }

    if (adminProfile.role === "barangay_admin" && adminProfile.barangayId !== barangayId) {
      throw new Error("You can only approve administrators for your own Barangay");
    }

    const targetData = await userRepository.getUserProfile(adminUid);
    if (!targetData) throw new Error("Admin profile not found");

    const bgyMunicipality = municipalityName || targetData.requestedMunicipalityName || "N/A";
    const bgyProvince = provinceName || targetData.requestedProvinceName || "N/A";
    const bgyRegion = regionName || targetData.requestedRegionName || "N/A";

    const updates = {
      status: "active" as const,
      activationStatus: "active" as const,
      activatedAt: new Date().toISOString(),
      role: "barangay_admin" as const,
      barangayId,
      barangayName,
      barangayMunicipality: bgyMunicipality,
      barangayProvince: bgyProvince,
      barangayRegion: bgyRegion,
      verified: true,
      verificationStatus: "approved" as const,
      approvedBy: adminProfile.uid,
      approvedAt: new Date().toISOString(),
      permissions: ["verify_residents", "assign_sk"]
    };
    await userRepository.updateUserProfile(adminUid, updates);

    await barangayRepository.createBarangayMerge(barangayId, {
      id: barangayId,
      name: barangayName,
      municipality: bgyMunicipality,
      province: bgyProvince,
      active: true,
      status: "approved",
      psgcCode: barangayId,
      barangayId,
      barangayName,
      municipalityName: bgyMunicipality,
      provinceName: bgyProvince,
      regionName: bgyRegion,
      zipCode: zipCode || "4103",
      assignedBarangayAdminUid: adminUid,
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
      activatedBy: adminProfile.uid,
      adminsCount: increment(1)
    });

    try {
      await verificationRepository.updateBarangayAdminRequest(adminUid, {
        status: "approved",
        approvedBy: adminProfile.uid
      });
    } catch (e) {}

    await auditRepository.writeAuditLog({
      action: "barangay_admin_approved",
      category: "Verification",
      severity: "Info",
      actorUid: adminProfile.uid,
      actorName: adminProfile.name,
      actorRole: adminProfile.role,
      targetUid: adminUid,
      targetName: targetData.name,
      targetRole: "barangay_admin",
      barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Assigned as admin for Barangay ${barangayName}`,
      metadata: { barangayId }
    });

    await notificationRepository.createNotification({
      barangayId,
      targetUid: adminUid,
      title: "Barangay Admin Approved",
      message: `Your application has been approved. You are now the assigned admin for Barangay ${barangayName}.`,
      createdAt: new Date().toISOString(),
      read: false
    });

    await emailService.triggerLifecycleEmail("approved", targetData.email, { name: targetData.name });
  },

  async suspendBarangayAdmin(adminProfile: UserProfile, adminUid: string, isSuspend: boolean): Promise<void> {
    if (!adminProfile || adminProfile.role !== "system_admin") {
      throw new Error("Only System Admin can suspend Barangay Admins");
    }

    const targetData = await userRepository.getUserProfile(adminUid);
    if (!targetData) throw new Error("Admin profile not found");

    await userRepository.updateUserProfile(adminUid, {
      status: isSuspend ? "suspended" : "active"
    });

    await auditRepository.writeAuditLog({
      action: isSuspend ? "barangay_admin_suspended" : "barangay_admin_reactivated",
      category: "Administration",
      severity: isSuspend ? "Warning" : "Info",
      actorUid: adminProfile.uid,
      actorName: adminProfile.name,
      actorRole: adminProfile.role,
      targetUid: adminUid,
      targetName: targetData.name,
      targetRole: targetData.role,
      barangayId: targetData.barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: isSuspend ? "Admin privileges suspended due to audit review" : "Suspension lifted",
      metadata: { targetUid: adminUid }
    });

    await notificationRepository.createNotification({
      barangayId: targetData.barangayId,
      targetUid: adminUid,
      title: isSuspend ? "Account Suspended" : "Account Reactivated",
      message: isSuspend
        ? "Your Barangay Admin privileges have been suspended. Please contact platform support."
        : "Your Barangay Admin privileges have been restored.",
      createdAt: new Date().toISOString(),
      read: false
    });

    await emailService.triggerLifecycleEmail("suspended", targetData.email, { name: targetData.name, isSuspend });
  },

  async lockProfileForReview(adminProfile: UserProfile, targetUid: string, isLock: boolean): Promise<void> {
    if (!adminProfile || (adminProfile.role !== "barangay_admin" && adminProfile.role !== "system_admin")) {
      throw new Error("Only authorized admins can lock profiles");
    }

    await userRepository.updateUserProfile(targetUid, {
      currentlyReviewedBy: isLock ? adminProfile.name : null,
      reviewStartedAt: isLock ? new Date().toISOString() : null
    });
  }
};
