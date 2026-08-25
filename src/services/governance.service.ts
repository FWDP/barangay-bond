import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { userRepository } from "../repositories/user.repository";
import { auditRepository } from "../repositories/audit.repository";
import { notificationRepository } from "../repositories/notification.repository";
import { emailService } from "./email.service";
import { dbAddDoc } from "../repositories/db.helper";
import { logger } from "../utils/logger";
import type { UserProfile } from "../types/domain.types";

export const governanceService = {
  async assignSKOfficial(
    adminProfile: UserProfile,
    residentUid: string,
    position: "chairman" | "kagawad" | "secretary" | "treasurer",
    termStart: string,
    termEnd: string
  ): Promise<void> {
    if (!adminProfile || adminProfile.role !== "barangay_admin") {
      throw new Error("Only Barangay Admin can assign SK positions");
    }

    const targetData = await userRepository.getUserProfile(residentUid);
    if (!targetData) throw new Error("Resident profile not found");

    if (targetData.barangayId !== adminProfile.barangayId) {
      throw new Error("Cannot promote residents outside your assigned Barangay");
    }

    // Duplicate slot lock check
    const q = query(
      collection(db, "users"),
      where("barangayId", "==", adminProfile.barangayId),
      where("role", "==", "sk_official"),
      where("position", "==", position),
      where("status", "==", "active")
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      throw new Error(`A resident is already assigned as active SK ${position} in this Barangay.`);
    }

    // 1. Create a historical record in terms subcollection and user.skHistory array
    const termsColl = collection(db, "users", residentUid, "terms");
    await dbAddDoc(termsColl, {
      position,
      start: termStart,
      end: termEnd,
      assignedBy: adminProfile.uid,
      reason: "Initial Appointment",
      timestamp: new Date().toISOString()
    });

    const currentHistory = targetData.skHistory || [];
    const newTermRecord = {
      position,
      termStart,
      termEnd,
      assignedAt: new Date().toISOString(),
      barangayId: adminProfile.barangayId,
      barangayName: adminProfile.barangayName,
      assignedByAdminUid: adminProfile.uid,
      assignedByAdminName: adminProfile.name,
    };

    // 2. Perform updates
    const updates = {
      role: "sk_official" as const,
      position,
      status: "active" as const,
      termStart,
      termEnd,
      acknowledgedPromotion: false,
      skHistory: [...currentHistory, newTermRecord],
      permissions: ["create_project", "upload_proof", "manage_milestones"]
    };
    await userRepository.updateUserProfile(residentUid, updates);

    // 3. Log to audit logs
    await auditRepository.writeAuditLog({
      action: "sk_official_assigned",
      category: "Governance",
      severity: "Info",
      actorUid: adminProfile.uid,
      actorName: adminProfile.name,
      actorRole: adminProfile.role,
      targetUid: residentUid,
      targetName: targetData.name,
      targetRole: "sk_official",
      barangayId: adminProfile.barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Promoted to active SK ${position} from ${termStart} to ${termEnd}`,
      metadata: { position, termEnd }
    });

    // 4. Send notification
    await notificationRepository.createNotification({
      barangayId: adminProfile.barangayId,
      targetUid: residentUid,
      title: "🎉 Congratulations! Promoted to SK Official",
      message: `You have been officially appointed as SK ${position.toUpperCase()} by Barangay Admin ${adminProfile.name}. Your term runs from ${termStart} to ${termEnd}. Governance proposal modules are now unlocked!`,
      createdAt: new Date().toISOString(),
      read: false
    });

    await emailService.triggerLifecycleEmail("sk_promoted", targetData.email, {
      name: targetData.name,
      position,
      termStart,
      termEnd,
      barangayName: adminProfile.barangayName
    });
  },

  async revokeSKOfficial(adminProfile: UserProfile, residentUid: string): Promise<void> {
    if (!adminProfile || adminProfile.role !== "barangay_admin") {
      throw new Error("Only Barangay Admin can revoke SK positions");
    }

    const targetData = await userRepository.getUserProfile(residentUid);
    if (!targetData) throw new Error("Resident profile not found");

    if (targetData.barangayId !== adminProfile.barangayId) {
      throw new Error("Cannot revoke users outside your assigned Barangay");
    }

    const prevPosition = targetData.position;

    const termsColl = collection(db, "users", residentUid, "terms");
    await dbAddDoc(termsColl, {
      position: "none",
      start: targetData.termStart || "",
      end: new Date().toISOString().split("T")[0],
      assignedBy: adminProfile.uid,
      reason: "Revoked by Barangay Admin",
      timestamp: new Date().toISOString()
    });

    const updatedHistory = (targetData.skHistory || []).map((term, idx, arr) => {
      if (idx === arr.length - 1 && !term.revokedAt) {
        return { ...term, revokedAt: new Date().toISOString() };
      }
      return term;
    });

    const updates = {
      role: "resident" as const,
      position: "none" as const,
      status: "active" as const,
      skHistory: updatedHistory,
      permissions: []
    };
    await userRepository.updateUserProfile(residentUid, updates);

    await auditRepository.writeAuditLog({
      action: "sk_official_revoked",
      category: "Governance",
      severity: "Warning",
      actorUid: adminProfile.uid,
      actorName: adminProfile.name,
      actorRole: adminProfile.role,
      targetUid: residentUid,
      targetName: targetData.name,
      targetRole: "resident",
      barangayId: adminProfile.barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Revoked term as SK ${prevPosition}`,
      metadata: { prevPosition }
    });

    await notificationRepository.createNotification({
      barangayId: adminProfile.barangayId,
      targetUid: residentUid,
      title: "SK Role Revoked",
      message: `Your active term as SK ${prevPosition} has been revoked by the Barangay Admin.`,
      createdAt: new Date().toISOString(),
      read: false
    });

    await emailService.triggerLifecycleEmail("sk_expired", targetData.email, {
      name: targetData.name,
      prevPosition
    });
  },

  async acknowledgeExpiration(uid: string): Promise<UserProfile> {
    const updates = {
      status: "active" as const,
      role: "resident" as const,
      position: "none" as const,
      permissions: []
    };
    await userRepository.updateUserProfile(uid, updates);
    const profile = await userRepository.getUserProfile(uid);
    if (!profile) throw new Error("User profile not found");
    return profile;
  },

  async checkAndDemoteExpiredSKOfficials(usersList: UserProfile[]): Promise<boolean> {
    const today = new Date().toISOString().split("T")[0];
    let didUpdate = false;

    for (const u of usersList) {
      if (u.role === "sk_official" && u.status === "active" && u.termEnd) {
        if (today > u.termEnd) {
          logger.info(`SK Official term expired for ${u.name} (Term End: ${u.termEnd}). Reverting to active Resident status.`, "GovernanceService");
          try {
            const expiredUpdates = {
              role: "resident" as const,
              position: "none" as const,
              status: "active" as const,
              permissions: []
            };
            await userRepository.updateUserProfile(u.uid, expiredUpdates);

            // Create notification
            await notificationRepository.createNotification({
              targetUid: u.uid,
              barangayId: u.barangayId,
              title: "SK Official Position Expired",
              message: `Your term as SK ${u.position.toUpperCase()} has expired on ${u.termEnd}. Reverted back to resident.`,
              createdAt: new Date().toISOString(),
              read: false
            });

            // Write Audit Log
            await auditRepository.writeAuditLog({
              action: "sk_official_expired",
              category: "Governance",
              severity: "Warning",
              actorUid: "system_auto",
              actorName: "System Automation",
              actorRole: "system_admin",
              targetUid: u.uid,
              targetName: u.name,
              targetRole: "resident",
              barangayId: u.barangayId,
              device: "System Scheduler",
              timestamp: new Date().toISOString(),
              notes: `SK official position ${u.position} expired automatically on ${u.termEnd}`
            });

            // Update local object representation
            u.role = "resident";
            u.position = "none";
            u.status = "active";
            u.permissions = [];
            didUpdate = true;
          } catch (err: any) {
            logger.error(`Automatic demotion failed for ${u.name}: ${err.message}`, "GovernanceService");
          }
        }
      }
    }
    return didUpdate;
  }
};
