import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { userRepository } from "../repositories/user.repository";
import { sessionRepository } from "../repositories/session.repository";
import { barangayRepository } from "../repositories/barangay.repository";
import { emailService } from "./email.service";
import { logger } from "../utils/logger";
import type { UserProfile, RegistrationStatus, VerificationStatus } from "../types/domain.types";
import { normalizeName, normalizeAddress, normalizeMobileNumber, normalizeEmail } from "../utils/normalization";

export const authService = {
  async signUpEmailPassword(email: string, password: string): Promise<UserProfile> {
    const normalizedEmail = normalizeEmail(email);
    const correlationId = `AUTH-INIT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    logger.auth(`Starting initial Auth account creation for: ${normalizedEmail}`, "AuthService", { correlationId });

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const uid = userCredential.user.uid;

      logger.auth("Sending Firebase verification email...", "AuthService");
      await sendEmailVerification(userCredential.user);
      await emailService.triggerLifecycleEmail("verify_email", normalizedEmail, { name: "Valued Resident" });

      const initialProfile: UserProfile = {
        uid,
        email: normalizedEmail,
        name: "",
        firstName: "",
        middleName: "",
        lastName: "",
        suffix: "",
        displayName: "",
        birthdate: "",
        age: 0,
        barangayId: "unassigned",
        barangayName: "Unassigned",
        barangayMunicipality: "N/A",
        barangayProvince: "N/A",
        role: "resident",
        requestedRole: "resident",
        status: "pending_email_verification",
        position: "none",
        permissions: [],
        walletAddress: null,
        walletProvider: null,
        walletVerified: false,
        walletLinkedAt: null,
        verified: false,
        verificationStatus: "pending",
        reviewOutcome: "approved",
        resubmissionPreset: "custom",
        resubmissionFields: [],
        resubmissionReason: "",
        resubmissionSuggestedReason: "",
        lastDecisionBy: null,
        lastDecisionAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mobileNumber: "",
        address: "",
        idType: "none",
        idNumber: "",
        schoolName: "N/A",
        idPhotoUrl: "N/A",
        selfiePhotoUrl: "N/A",
        professionalInfo: "N/A",
        adminReason: "N/A",
        profilePhotoUrl: "N/A",
        photoURL: "",
        lastLogin: new Date().toISOString(),
        emailVerified: false,
        aiVerificationId: "",
        duplicateRisk: false,
        verificationNotes: "",
        verifiedBy: "",
        verifiedAt: "",
      };

      logger.database(`Creating initial database profile document users/${uid}`, "AuthService", { correlationId });
      await userRepository.createUserProfile(uid, initialProfile);

      return initialProfile;
    } catch (err: any) {
      logger.error(`Initial account creation failed: ${err.message}`, "AuthService", { correlationId });
      if (err.code === "auth/email-already-in-use" || err.message?.includes("email-already-in-use")) {
        const usersList = await userRepository.queryUsersByEmail(normalizedEmail);
        if (usersList.length > 0) {
          const existingProfile = usersList[0];
          const reason = existingProfile.verificationNotes || existingProfile.resubmissionReason || existingProfile.autoRejectReason || "Please contact your Barangay Administrator.";
          const duplicateErr = new Error(`This email is already registered. Your previous account is currently inactive or rejected. ${reason}`);
          (duplicateErr as any).code = "auth/email-already-in-use";
          throw duplicateErr;
        }
      }
      throw err;
    }
  },

  async signUp(
    fields: {
      email: string;
      firstName: string;
      middleName: string;
      lastName: string;
      suffix: string;
      birthdate: string;
      barangayId: string;
      barangayName: string;
      barangayMunicipality: string;
      barangayProvince: string;
      desiredRole: "resident" | "barangay_admin";
      mobileNumber: string;
      address: string;
      idType: string;
      idNumber: string;
      schoolName: string;
      professionalInfo?: string;
      adminReason?: string;
      barangayRegion?: string;
    },
    password?: string
  ): Promise<UserProfile> {
    const correlationId = `AUTH-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const startTime = Date.now();

    const email = normalizeEmail(fields.email);
    const firstName = normalizeName(fields.firstName);
    const middleName = normalizeName(fields.middleName);
    const lastName = normalizeName(fields.lastName);
    const suffix = normalizeName(fields.suffix);
    const mobileNumber = normalizeMobileNumber(fields.mobileNumber);
    const address = normalizeAddress(fields.address);

    const displayName = `${firstName} ${middleName ? middleName + " " : ""}${lastName}${suffix ? " " + suffix : ""}`;
    const name = displayName;

    logger.auth(`Registration signUp request started for: ${email} (${fields.desiredRole})`, "AuthService", {
      correlationId,
      metadata: { name, birthdate: fields.birthdate, barangayName: fields.barangayName, idType: fields.idType, idNumber: fields.idNumber }
    });

    // Age checks for resident
    let age = 0;
    if (fields.desiredRole === "resident") {
      const today = new Date();
      const birth = new Date(fields.birthdate);
      age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      logger.debug(`Layer 1 rule validation: Calculated resident age is ${age} yrs`, "AuthService", { correlationId });
      if (age < 15) {
        logger.warn(`Layer 1 rule validation failed: Age ${age} below minimum requirement (15).`, "AuthService", { correlationId });
        throw new Error("Age validation failed. Residents must be at least 15 years old.");
      }

      // Selected barangay check
      const bgy = await barangayRepository.getBarangay(fields.barangayId);
      if (!bgy || (bgy.status !== "approved" && bgy.active !== true)) {
        logger.warn(`Layer 1 rule validation failed: Selected barangay ${fields.barangayId} is inactive/unapproved.`, "AuthService", { correlationId });
        throw new Error("Selected barangay is no longer active or approved.");
      }
    }

    let uid = "";
    let userCredentialObj = null;

    if (auth.currentUser) {
      if (auth.currentUser.email?.toLowerCase() === email.toLowerCase()) {
        uid = auth.currentUser.uid;
        logger.debug(`Found existing active auth session for ${email}. Bypassing createUserWithEmailAndPassword.`, "AuthService", { correlationId });
      } else {
        logger.warn(`Existing auth session email (${auth.currentUser.email}) differs from registration email (${email}). Signing out stale session.`, "AuthService", { correlationId });
        await firebaseSignOut(auth);
        logger.debug("Creating Firebase Auth credential after stale session cleanup...", "AuthService", { correlationId });
        if (!password) throw new Error("Password required for new account creation");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        userCredentialObj = userCredential;
        uid = userCredential.user.uid;
      }
    } else {
      logger.debug("Creating Firebase Auth credential...", "AuthService", { correlationId });
      if (!password) throw new Error("Password required for new account creation");
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userCredentialObj = userCredential;
      uid = userCredential.user.uid;
    }

    try {
      let initialRole = fields.desiredRole as "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer";
      let isEmailVerified = auth.currentUser ? auth.currentUser.emailVerified : false;
      let initialStatus: RegistrationStatus = isEmailVerified ? "pending" : "pending_email_verification";
      let initialVerified = false;
      let initialVerStatus: VerificationStatus = "pending";
      let initialPermissions: string[] = [];

      // Overwrite for Age > 30 resident: register as Viewer instead
      if (fields.desiredRole === "resident" && age > 30) {
        logger.info(`Resident age ${age} > 30. Redirecting signup to Viewer role.`, "AuthService", { correlationId });
        initialRole = "viewer";
        initialStatus = "active";
        initialVerified = true;
        initialVerStatus = "approved";
      }

      const newProfile: UserProfile = {
        uid,
        email,
        name,
        firstName,
        middleName,
        lastName,
        suffix,
        displayName,
        birthdate: fields.birthdate,
        age,
        barangayId: fields.desiredRole === "barangay_admin" ? "unassigned" : fields.barangayId,
        barangayName: fields.desiredRole === "barangay_admin" ? "Unassigned" : fields.barangayName,
        barangayMunicipality: fields.desiredRole === "barangay_admin" ? "N/A" : fields.barangayMunicipality,
        barangayProvince: fields.desiredRole === "barangay_admin" ? "N/A" : fields.barangayProvince,
        barangayRegion: fields.desiredRole === "resident" ? (fields.barangayRegion || "N/A") : "N/A",
        requestedBarangayId: fields.desiredRole === "barangay_admin" ? (fields.barangayId || "N/A") : "N/A",
        requestedBarangayName: fields.desiredRole === "barangay_admin" ? (fields.barangayName || "N/A") : "N/A",
        requestedMunicipalityName: fields.desiredRole === "barangay_admin" ? (fields.barangayMunicipality || "N/A") : "N/A",
        requestedProvinceName: fields.desiredRole === "barangay_admin" ? (fields.barangayProvince || "N/A") : "N/A",
        requestedRegionName: fields.desiredRole === "barangay_admin" ? (fields.barangayRegion || "N/A") : "N/A",
        role: initialRole,
        requestedRole: fields.desiredRole,
        status: initialStatus,
        position: "none",
        permissions: initialPermissions,
        walletAddress: null,
        walletProvider: null,
        walletVerified: false,
        walletLinkedAt: null,
        verified: initialVerified,
        verificationStatus: initialVerStatus,
        reviewOutcome: "approved",
        resubmissionPreset: "custom",
        resubmissionFields: [],
        resubmissionReason: "",
        resubmissionSuggestedReason: "",
        lastDecisionBy: null,
        lastDecisionAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mobileNumber,
        address,
        idType: fields.idType,
        idNumber: fields.idNumber,
        schoolName: fields.schoolName,
        idPhotoUrl: "N/A",
        selfiePhotoUrl: "N/A",
        professionalInfo: fields.professionalInfo || "N/A",
        adminReason: fields.adminReason || "N/A",
        profilePhotoUrl: "N/A",
        photoURL: "",
        lastLogin: new Date().toISOString(),
        emailVerified: isEmailVerified,
        aiVerificationId: "",
        duplicateRisk: false,
        verificationNotes: "",
        verifiedBy: "",
        verifiedAt: "",
      };

      const existingProfile = await userRepository.getUserProfile(uid);
      if (existingProfile) {
        logger.database(`User ${uid} exists (status: ${existingProfile.status}) — performing merge update via updateUserProfile`, "AuthService", { correlationId });
        await userRepository.updateUserProfile(uid, {
          name: newProfile.name,
          firstName: newProfile.firstName,
          middleName: newProfile.middleName,
          lastName: newProfile.lastName,
          suffix: newProfile.suffix,
          displayName: newProfile.displayName,
          birthdate: newProfile.birthdate,
          age: newProfile.age,
          mobileNumber: newProfile.mobileNumber,
          address: newProfile.address,
          idType: newProfile.idType,
          idNumber: newProfile.idNumber,
          schoolName: newProfile.schoolName,
          professionalInfo: newProfile.professionalInfo,
          adminReason: newProfile.adminReason,
          idPhotoUrl: newProfile.idPhotoUrl,
          selfiePhotoUrl: newProfile.selfiePhotoUrl,
          profilePhotoUrl: newProfile.profilePhotoUrl,
          photoURL: newProfile.photoURL,
          requestedBarangayId: newProfile.requestedBarangayId,
          requestedBarangayName: newProfile.requestedBarangayName,
          requestedMunicipalityName: newProfile.requestedMunicipalityName,
          requestedProvinceName: newProfile.requestedProvinceName,
          requestedRegionName: newProfile.requestedRegionName,
          requestedRole: newProfile.requestedRole,
          status: newProfile.status,
          verificationStatus: newProfile.verificationStatus,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await userRepository.createUserProfile(uid, newProfile);
      }

      if (newProfile.status === "pending_email_verification") {
        logger.auth("Sending Firebase verification email...", "AuthService");
        const targetUser = userCredentialObj ? userCredentialObj.user : auth.currentUser;
        if (targetUser) {
          await sendEmailVerification(targetUser);
          await userRepository.updateUserProfile(uid, {
            verificationEmailSentAt: new Date().toISOString()
          });

          await emailService.triggerLifecycleEmail("registration_submitted", email, {
            name,
            role: fields.desiredRole,
            barangayName: fields.desiredRole === "barangay_admin" ? "Unassigned" : fields.barangayName
          });
          await emailService.triggerLifecycleEmail("verify_email", email, { name });
        }
      } else {
        await emailService.triggerLifecycleEmail("registration_submitted", email, {
          name,
          role: fields.desiredRole,
          barangayName: fields.desiredRole === "barangay_admin" ? "Unassigned" : fields.barangayName
        });
      }

      logger.success(`Registration complete for ${email}. Status: ${newProfile.status}`, "AuthService", {
        correlationId,
        durationMs: Date.now() - startTime
      });
      return newProfile;
    } catch (innerErr) {
      if (auth.currentUser && !userCredentialObj) {
        logger.warn(`Inner registration steps failed for existing user. Keeping session active.`, "AuthService", { correlationId });
      } else if (auth.currentUser) {
        logger.warn(`Inner registration steps failed. Cleaning up auth session...`, "AuthService", { correlationId });
        try {
          await firebaseSignOut(auth);
        } catch (e) { }
      }
      throw innerErr;
    }
  },

  async signIn(email: string, password: string): Promise<UserProfile> {
    const correlationId = `AUTH-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const startTime = Date.now();
    logger.auth(`Login request started for: ${email}`, "AuthService", { correlationId });

    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (firebaseErr: any) {
      logger.warn(`Firebase login failed for: ${email}`, "AuthService", { correlationId, error: firebaseErr.message, code: firebaseErr.code });
      if (
        firebaseErr.code === "auth/invalid-credential" ||
        firebaseErr.code === "auth/user-not-found" ||
        firebaseErr.code === "auth/wrong-password"
      ) {
        throw new Error("Invalid email address or password. Please check your login credentials and try again.");
      }
      if (firebaseErr.code === "auth/invalid-email") {
        throw new Error("Please enter a valid email address.");
      }
      if (firebaseErr.code === "auth/user-disabled") {
        throw new Error("This account has been disabled. Please contact system administration.");
      }
      if (firebaseErr.code === "auth/too-many-requests") {
        throw new Error("Access to this account has been temporarily disabled due to multiple failed login attempts. Please try again later or reset your password.");
      }
      throw firebaseErr;
    }

    const loadedProfile = await userRepository.getUserProfile(userCredential.user.uid);

    if (loadedProfile) {
      if (loadedProfile.status === "suspended") {
        logger.warn(`Login rejected: User ${email} is suspended`, "AuthService", { correlationId });
        await firebaseSignOut(auth);
        const err = new Error("Your account has been suspended by the platform administrator.");
        (err as any).code = "auth/suspended";
        throw err;
      }

      if (loadedProfile.status === "inactive") {
        logger.warn(`Login rejected: User ${email} is inactive`, "AuthService", { correlationId });
        const reason = loadedProfile.verificationNotes || loadedProfile.resubmissionReason || loadedProfile.autoRejectReason || "Please contact your Barangay Administrator.";
        const message = `Your account is inactive. ${reason}`;
        const err = new Error(message);
        (err as any).code = "auth/inactive";
        (err as any).profile = loadedProfile;
        throw err;
      }

      logger.success(`Login successful for ${email}`, "AuthService", {
        correlationId,
        durationMs: Date.now() - startTime
      });

      // Write session details
      try {
        const userAgent = navigator.userAgent;
        let browser = "Unknown Browser";
        let platform = "Unknown Platform";
        let deviceType = "Desktop";

        if (userAgent.indexOf("Firefox") > -1) browser = "Firefox";
        else if (userAgent.indexOf("Chrome") > -1) browser = "Chrome";
        else if (userAgent.indexOf("Safari") > -1) browser = "Safari";

        if (userAgent.indexOf("Win") > -1) platform = "Windows";
        else if (userAgent.indexOf("Mac") > -1) platform = "MacOS";
        else if (userAgent.indexOf("Android") > -1) { platform = "Android"; deviceType = "Mobile"; }
        else if (userAgent.indexOf("iPhone") > -1) { platform = "iOS"; deviceType = "Mobile"; }

        await sessionRepository.createSession({
          uid: loadedProfile.uid,
          sessionId: Math.random().toString(36).substring(2, 15),
          browser,
          platform,
          deviceType,
          loginTime: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to write session details:", err);
      }

      return loadedProfile;
    }

    throw new Error("User profile not found");
  },

  async signOut(): Promise<void> {
    logger.auth("Signing out user...", "AuthService");
    await firebaseSignOut(auth);
  },

  async sendVerificationEmail(user: User, profile: UserProfile | null): Promise<void> {
    logger.auth("Sending Firebase verification email...", "AuthService");
    try {
      await user.reload();
      await sendEmailVerification(user);
    } catch (err: any) {
      logger.error(`Firebase sendEmailVerification failed: ${err.message}`, "AuthService");
      if (err.message?.includes("too-many-requests") || err.code === "auth/too-many-requests" || err.message?.includes("TOO_MANY_ATTEMPTS")) {
        throw new Error("Too many verification attempts. Please check your inbox or wait a few minutes before requesting another link.");
      }
      throw new Error(`Activation service error: ${err.message || "Bad Request"}`);
    }

    if (profile) {
      await userRepository.updateUserProfile(user.uid, {
        verificationEmailSentAt: new Date().toISOString()
      });
    }

    await emailService.triggerLifecycleEmail("verify_email", user.email || "", {
      name: profile?.name || "Valued Resident"
    });
  },

  async checkEmailVerificationStatus(user: User, profile: UserProfile | null): Promise<{ verified: boolean; profile: UserProfile | null }> {
    logger.auth("Checking email verification status...", "AuthService");
    await user.reload();
    if (user.emailVerified) {
      if (profile && profile.emailVerified) {
        // Skip redundant database writes if the profile is already email-verified
        return { verified: true, profile };
      }

      const isFullyRegistered = profile && profile.firstName && profile.firstName.trim() !== "";
      const updates = {
        emailVerified: true,
        status: isFullyRegistered ? ("pending" as const) : ("onboarding" as const),
        activationStatus: isFullyRegistered ? ("active" as const) : ("pending_email_verification" as const),
        activatedAt: new Date().toISOString()
      };

      let updatedProfile: UserProfile | null = null;
      if (profile) {
        // Force-refresh the Firebase Auth ID token to propagate the email_verified claim to Firestore rules
        await user.getIdToken(true);
        await userRepository.updateUserProfile(user.uid, updates);
        updatedProfile = { ...profile, ...updates };
      } else {
        updatedProfile = {
          uid: user.uid,
          email: user.email || "",
          role: "resident",
          requestedRole: "resident",
          name: "",
          firstName: "",
          middleName: "",
          lastName: "",
          suffix: "",
          displayName: "",
          birthdate: "",
          age: 0,
          barangayId: "unassigned",
          barangayName: "Unassigned",
          barangayMunicipality: "N/A",
          barangayProvince: "N/A",
          verified: false,
          verificationStatus: "pending",
          ...updates
        } as any;
        await userRepository.createUserProfile(user.uid, updatedProfile as UserProfile);
      }
      logger.success("User email verified successfully!", "AuthService");

      await emailService.triggerLifecycleEmail("activated", user.email || "", {
        name: profile?.firstName ? profile.firstName : "Valued Resident"
      });

      return { verified: true, profile: updatedProfile };
    }
    return { verified: false, profile };
  },

  async deleteCurrentUserForResubmission(): Promise<void> {
    if (auth.currentUser) {
      logger.auth("Deleting failed user account for immediate resubmission...", "AuthService");
      await auth.currentUser.delete();
    }
  }
};
