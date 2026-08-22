import { userRepository } from "../repositories/user.repository";
import { verificationRepository, type UploadedDocumentEntry, type AIVerificationEntry, type DuplicateReportEntry, type BarangayAdminRequestEntry, type ResidentVerificationQueueEntry } from "../repositories/verification.repository";
import { walletRepository } from "../repositories/wallet.repository";
import { emailService } from "./email.service";
import { GeminiIdentityProvider, checkDuplicates } from "./gemini";
import { logger } from "../utils/logger";
import type { UserProfile } from "../types/domain.types";
import { getResubmissionFieldsForPreset, getResubmissionSuggestedReasonForPreset, inferResubmissionFields, inferResubmissionPreset } from "../utils/reviewDecision";

export const verificationService = {
  async executeAIVerification(
    uid: string,
    activeProfile: UserProfile,
    idPhotoUrl: string,
    selfiePhotoUrl: string,
    profilePhotoUrl: string
  ): Promise<UserProfile> {
    const correlationId = `AI-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const startTime = Date.now();

    logger.auth(`Starting identity visual audit for user: ${uid}`, "VerificationService", { correlationId });

    if (activeProfile.role === "viewer" || activeProfile.status === "active") {
      logger.info(`User ${activeProfile.email} is already active or has Viewer role. Skipping AI visual audit.`, "VerificationService", { correlationId });
      return activeProfile;
    }

    try {
      // 1. Upload assets to Firestore documents (base64 compressed strings)
      logger.info(`Storing compressed documents for ${uid}...`, "VerificationService", { correlationId });
      const idDoc: UploadedDocumentEntry = {
        uid,
        documentType: activeProfile.idType,
        storagePath: `database/${uid}/id_photo`,
        base64Url: idPhotoUrl,
        hash: `${uid}_id_hash`,
        uploadedAt: new Date().toISOString()
      };
      await verificationRepository.createUploadedDocument(`${uid}_id`, idDoc);

      let storageSelfieUrl = "N/A";
      if (selfiePhotoUrl && selfiePhotoUrl !== "N/A") {
        storageSelfieUrl = selfiePhotoUrl;
        const selfieDoc: UploadedDocumentEntry = {
          uid,
          documentType: "selfie_holding_id",
          storagePath: `database/${uid}/selfie_photo`,
          base64Url: selfiePhotoUrl,
          hash: `${uid}_selfie_hash`,
          uploadedAt: new Date().toISOString()
        };
        await verificationRepository.createUploadedDocument(`${uid}_selfie`, selfieDoc);
      }

      let storageProfileUrl = "N/A";
      if (profilePhotoUrl && profilePhotoUrl !== "N/A") {
        storageProfileUrl = profilePhotoUrl;
        const avatarDoc: UploadedDocumentEntry = {
          uid,
          documentType: "profile_avatar",
          storagePath: `database/${uid}/avatar`,
          base64Url: profilePhotoUrl,
          hash: `${uid}_avatar_hash`,
          uploadedAt: new Date().toISOString()
        };
        await verificationRepository.createUploadedDocument(`${uid}_avatar`, avatarDoc);
      }

      // 2. Perform duplicate scans
      let dupResult = { maxScore: 0, matches: [] as any[] };
      try {
        dupResult = await checkDuplicates(
          activeProfile.name,
          activeProfile.birthdate,
          activeProfile.idNumber,
          activeProfile.address,
          activeProfile.mobileNumber,
          uid
        );
        logger.info(`Layer 2 duplicate scan finished. Max similarity match: ${dupResult.maxScore}%`, "VerificationService", { correlationId });
      } catch (dupError: any) {
        logger.warn(`Duplicate check failed/bypassed: ${dupError.message}`, "VerificationService");
      }

      const hasExactDuplicate = dupResult.matches.length > 0 && dupResult.matches.some((m: any) => m.similarity >= 95);

      const updatedProfile = { ...activeProfile };
      updatedProfile.idPhotoUrl = idPhotoUrl;
      updatedProfile.selfiePhotoUrl = storageSelfieUrl;
      updatedProfile.profilePhotoUrl = storageProfileUrl;
      updatedProfile.photoURL = storageProfileUrl === "N/A" ? "" : storageProfileUrl;

      let aiResult: any = null;

      if (hasExactDuplicate) {
        logger.warn(`Duplicate check failed: Exact match exists.`, "VerificationService", { correlationId });
        updatedProfile.verificationStatus = "auto_rejected";
        updatedProfile.status = "pending";
        updatedProfile.aiDecision = "auto_reject";
        updatedProfile.riskScore = 100;
        updatedProfile.duplicateScore = dupResult.maxScore;
        updatedProfile.autoRejectReason = "Exact duplicate identity or ID number found in database.";
        updatedProfile.reviewOutcome = "resubmission_required";
        updatedProfile.resubmissionPreset = inferResubmissionPreset(updatedProfile.autoRejectReason);
        updatedProfile.resubmissionFields = getResubmissionFieldsForPreset(updatedProfile.resubmissionPreset, inferResubmissionFields(updatedProfile.autoRejectReason, ["idNumber"]));
        updatedProfile.resubmissionReason = updatedProfile.autoRejectReason;
        updatedProfile.resubmissionSuggestedReason = getResubmissionSuggestedReasonForPreset(updatedProfile.resubmissionPreset, updatedProfile.resubmissionFields);
      } else {
        logger.ai(`Layer 3: Triggering Gemini Vision visual check...`, "VerificationService", { correlationId });
        const geminiProvider = new GeminiIdentityProvider();
        try {
          const isBgyAdmin = activeProfile.requestedRole === "barangay_admin";
          aiResult = await geminiProvider.analyzeIdentity({
            name: activeProfile.name,
            birthdate: activeProfile.birthdate,
            address: activeProfile.address,
            barangayName: isBgyAdmin ? (activeProfile.requestedBarangayName || activeProfile.barangayName) : activeProfile.barangayName,
            municipality: isBgyAdmin ? (activeProfile.requestedMunicipalityName || activeProfile.barangayMunicipality) : activeProfile.barangayMunicipality,
            province: isBgyAdmin ? (activeProfile.requestedProvinceName || activeProfile.barangayProvince) : activeProfile.barangayProvince,
            idType: activeProfile.idType,
            idNumber: activeProfile.idNumber,
            imageDataUrl: idPhotoUrl
          });

          logger.success("Layer 3 Gemini Vision returned structured JSON extraction successfully", "VerificationService", {
            correlationId,
            metadata: aiResult
          });

          if (aiResult.confidence < 50) {
            logger.warn(`AI score ${aiResult.confidence}% is below threshold. Deleting user session...`, "VerificationService");

            await verificationRepository.deleteUploadedDocument(`${uid}_id`);
            if (selfiePhotoUrl && selfiePhotoUrl !== "N/A") {
              await verificationRepository.deleteUploadedDocument(`${uid}_selfie`);
            }
            if (profilePhotoUrl && profilePhotoUrl !== "N/A") {
              await verificationRepository.deleteUploadedDocument(`${uid}_avatar`);
            }
            await userRepository.deleteUserProfile(uid);

            const err = new Error("AI_SCORE_BELOW_THRESHOLD");
            (err as any).confidence = aiResult.confidence;
            (err as any).reasons = aiResult.reasons;
            (err as any).decision = aiResult.recommendation;
            throw err;
          }

          const isAutoReject =
            aiResult.recommendation === "AUTO_REJECT" ||
            !aiResult.faceDetected ||
            aiResult.tamperingDetected ||
            aiResult.screenshotDetected ||
            aiResult.aiGeneratedDetected ||
            !aiResult.imageQuality.readable;

          const hasDuplicateRisk = dupResult.maxScore >= 70;
          const forceDuplicateResubmission = hasDuplicateRisk && activeProfile.requestedRole === "resident";

          if (forceDuplicateResubmission) {
            logger.warn(`Duplicate risk threshold reached (${dupResult.maxScore}%). Forcing full-package resubmission.`, "VerificationService", { correlationId });
            updatedProfile.verificationStatus = "auto_rejected";
            updatedProfile.status = "pending";
            updatedProfile.aiDecision = "auto_reject";
            updatedProfile.riskScore = aiResult?.riskScore ?? dupResult.maxScore;
            updatedProfile.duplicateScore = dupResult.maxScore;
            updatedProfile.autoRejectReason = "Duplicate identity or strongly matching registration detected. Please resubmit the full profile details and documents.";
            updatedProfile.reviewOutcome = "resubmission_required";
            updatedProfile.resubmissionPreset = "full_package";
            updatedProfile.resubmissionFields = getResubmissionFieldsForPreset("full_package");
            updatedProfile.resubmissionReason = updatedProfile.autoRejectReason;
            updatedProfile.resubmissionSuggestedReason = getResubmissionSuggestedReasonForPreset(updatedProfile.resubmissionPreset, updatedProfile.resubmissionFields);
          } else if (isAutoReject) {
            logger.warn(`AI Analysis triggered AUTO_REJECT recommendation`, "VerificationService", { correlationId });
            updatedProfile.verificationStatus = "auto_rejected";
            updatedProfile.status = "pending";
            updatedProfile.aiDecision = "auto_reject";
            updatedProfile.riskScore = aiResult.riskScore;
            updatedProfile.autoRejectReason = aiResult.reasons.join(", ") || "Failed document quality or authenticity check.";
            updatedProfile.reviewOutcome = "resubmission_required";
            updatedProfile.resubmissionPreset = inferResubmissionPreset(updatedProfile.autoRejectReason);
            const autoRejectReason = updatedProfile.autoRejectReason || "";
            const fallbackFields = inferResubmissionFields(autoRejectReason, ["idPhotoUrl"]);
            updatedProfile.resubmissionFields = getResubmissionFieldsForPreset(updatedProfile.resubmissionPreset, fallbackFields);
            if (autoRejectReason.toLowerCase().includes("selfie")) {
              updatedProfile.resubmissionFields = Array.from(new Set([...(updatedProfile.resubmissionFields || []), "selfiePhotoUrl"]));
            }
            updatedProfile.resubmissionReason = autoRejectReason;
            updatedProfile.resubmissionSuggestedReason = getResubmissionSuggestedReasonForPreset(updatedProfile.resubmissionPreset, updatedProfile.resubmissionFields);
          } else if (activeProfile.requestedRole === "barangay_admin") {
            logger.info(`AI analysis evaluated for Barangay Admin. Queueing for System Admin review.`, "VerificationService", { correlationId });
            updatedProfile.verificationStatus = "pending";
            updatedProfile.status = "pending";
            updatedProfile.aiDecision = (aiResult.recommendation === "AUTO_ACCEPT" && aiResult.riskScore === 0 && aiResult.confidence >= 99)
              ? "auto_accept"
              : "manual_review";
            updatedProfile.riskScore = aiResult.riskScore;
            updatedProfile.reviewOutcome = "approved";
          } else {
            if (
              aiResult.recommendation === "AUTO_ACCEPT" &&
              aiResult.riskScore === 0 &&
              aiResult.confidence >= 99 &&
              dupResult.maxScore < 70
            ) {
              logger.success(`AI Analysis triggered AUTO_ACCEPT fast-track recommendation`, "VerificationService", { correlationId });
              updatedProfile.verificationStatus = "ai_verified";
              updatedProfile.aiDecision = "auto_accept";
              updatedProfile.riskScore = 0;
              updatedProfile.reviewOutcome = "approved";
            } else {
              logger.info(`AI Analysis queued profile for MANUAL_REVIEW`, "VerificationService", { correlationId });
              updatedProfile.verificationStatus = "pending";
              updatedProfile.aiDecision = "manual_review";
              updatedProfile.riskScore = aiResult.riskScore;
              updatedProfile.reviewOutcome = "approved";
            }
          }

          const verificationId = `${uid}_${Date.now()}`;
          const verificationDoc: AIVerificationEntry = {
            userId: uid,
            version: "v1",
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            documentType: aiResult.documentType,
            confidence: aiResult.confidence,
            imageQuality: aiResult.imageQuality,
            extractedFields: aiResult.extractedFields,
            fieldMatches: aiResult.fieldMatches,
            riskScore: aiResult.riskScore,
            recommendation: aiResult.recommendation,
            reasons: aiResult.reasons,
            explanation: aiResult.reasons.join(", "),
            decision: aiResult.decision,
            scores: aiResult.scores,
            duplicateRisk: dupResult.maxScore >= 70,
            status: "completed"
          };
          await verificationRepository.createAIVerification(verificationId, verificationDoc);

          updatedProfile.aiVerificationId = verificationId;
          updatedProfile.duplicateScore = dupResult.maxScore;
          updatedProfile.requiresManualReview = (updatedProfile.verificationStatus === "pending");
          updatedProfile.imageQualitySummary = Object.entries(aiResult.imageQuality)
            .filter(([_, val]) => val)
            .map(([key, _]) => key)
            .join(", ") || "Good";
          updatedProfile.decision = aiResult.decision;
          updatedProfile.scores = aiResult.scores;

        } catch (geminiError: any) {
          if (geminiError.message === "AI_SCORE_BELOW_THRESHOLD") {
            throw geminiError;
          }
          logger.error(`Gemini verification error, falling back: ${geminiError.message}`, "VerificationService", { correlationId });
          updatedProfile.verificationStatus = "pending";
          updatedProfile.aiDecision = "manual_review";
          updatedProfile.riskScore = 50;
          updatedProfile.duplicateScore = dupResult.maxScore;
          updatedProfile.verificationNotes = "AI identity analysis was temporarily offline. Pending manual audit.";
          updatedProfile.requiresManualReview = true;
        }
      }

      if (updatedProfile.verificationStatus === "ai_verified") {
        updatedProfile.status = "pending";
      } else if (updatedProfile.verificationStatus === "auto_rejected") {
        updatedProfile.status = "pending";
      }

      logger.database(`Updating users/${uid} with AI verification results in Firestore`, "VerificationService", { correlationId });
      await userRepository.updateUserProfile(uid, {
        name: updatedProfile.name,
        firstName: updatedProfile.firstName,
        middleName: updatedProfile.middleName,
        lastName: updatedProfile.lastName,
        suffix: updatedProfile.suffix,
        displayName: updatedProfile.displayName,
        birthdate: updatedProfile.birthdate,
        age: updatedProfile.age,
        mobileNumber: updatedProfile.mobileNumber,
        address: updatedProfile.address,
        idType: updatedProfile.idType,
        idNumber: updatedProfile.idNumber,
        schoolName: updatedProfile.schoolName,
        barangayId: updatedProfile.barangayId,
        barangayName: updatedProfile.barangayName,
        barangayMunicipality: updatedProfile.barangayMunicipality,
        barangayProvince: updatedProfile.barangayProvince,
        barangayRegion: updatedProfile.barangayRegion ?? "",
        idPhotoUrl: updatedProfile.idPhotoUrl,
        selfiePhotoUrl: updatedProfile.selfiePhotoUrl,
        profilePhotoUrl: updatedProfile.profilePhotoUrl,
        photoURL: updatedProfile.photoURL,
        verificationStatus: updatedProfile.verificationStatus,
        status: updatedProfile.status,
        aiDecision: updatedProfile.aiDecision,
        riskScore: updatedProfile.riskScore ?? undefined,
        duplicateScore: updatedProfile.duplicateScore ?? undefined,
        autoRejectReason: updatedProfile.autoRejectReason ?? "",
        reviewOutcome: updatedProfile.reviewOutcome ?? "approved",
        resubmissionPreset: updatedProfile.resubmissionPreset ?? "custom",
        resubmissionFields: updatedProfile.resubmissionFields ?? [],
        resubmissionReason: updatedProfile.resubmissionReason ?? "",
        resubmissionSuggestedReason: updatedProfile.resubmissionSuggestedReason ?? "",
        aiVerificationId: updatedProfile.aiVerificationId ?? "",
        requiresManualReview: updatedProfile.requiresManualReview ?? false,
        imageQualitySummary: updatedProfile.imageQualitySummary ?? "",
        decision: updatedProfile.decision ?? "",
        scores: updatedProfile.scores ?? null,
        verificationNotes: updatedProfile.verificationNotes ?? "",
        updatedAt: new Date().toISOString(),
      });

      await emailService.triggerLifecycleEmail("ai_completed", activeProfile.email, {
        name: activeProfile.name,
        confidence: aiResult ? aiResult.confidence : 0,
        decision: aiResult ? aiResult.recommendation : "AUTO_REJECT"
      });

      if (activeProfile.walletAddress) {
        await walletRepository.linkWallet(uid, activeProfile.walletAddress, activeProfile.walletProvider || "freighter");
      }

      if (activeProfile.requestedRole === "barangay_admin") {
        logger.database(`Adding ${uid} to barangay_admin_requests queue`, "VerificationService", { correlationId });
        const adminReq: BarangayAdminRequestEntry = {
          uid,
          barangayId: "unassigned",
          status: "pending",
          submittedAt: new Date().toISOString(),
          approvedBy: null
        };
        await verificationRepository.createBarangayAdminRequest(uid, adminReq);
      } else if (activeProfile.requestedRole === "resident") {
        logger.database(`Adding ${uid} to resident_verification_queue`, "VerificationService", { correlationId });
        const resReq: ResidentVerificationQueueEntry = {
          uid,
          barangayId: activeProfile.barangayId,
          status: "pending",
          submittedAt: new Date().toISOString(),
          aiRisk: updatedProfile.aiDecision || "pending",
          duplicate: updatedProfile.duplicateRisk || false
        };
        await verificationRepository.createResidentVerificationQueueEntry(uid, resReq);
      }

      if (typeof dupResult !== "undefined" && dupResult.matches && dupResult.matches.length > 0) {
        updatedProfile.duplicateRisk = true;
        for (const match of dupResult.matches) {
          const reportId = `${uid}_${match.userId}`;
          const dupReport: DuplicateReportEntry = {
            userId: uid,
            matchedUser: match.userId,
            reason: match.matchedFields.join(", "),
            similarity: match.similarity,
            status: "pending"
          };
          await verificationRepository.createDuplicateReport(reportId, dupReport);
        }
      }

      logger.success(`Identity verification completed for ${activeProfile.email}. Status: ${updatedProfile.status}`, "VerificationService", {
        correlationId,
        durationMs: Date.now() - startTime
      });
      (updatedProfile as any).aiExtractedFields = aiResult ? aiResult.extractedFields : null;
      return updatedProfile;

    } catch (err: any) {
      logger.error(`executeAIVerification failed: ${err.message}`, "VerificationService", { correlationId });
      throw err;
    }
  }
};
