import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { collection, query, getDocs, where } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { logger } from "../utils/logger";
import type { UserProfile, Barangay } from "../types/domain.types";
import type { ResubmissionFieldKey, ResubmissionPresetKey } from "../utils/reviewDecision";
import { STELLAR_CONFIG } from "../configuration/config";
import { verifyWalletLinkSignature, disconnectWallet as kitDisconnect } from "../wallet/wallet";
import { purgeAllWalletStorage } from "./WalletContext";

// Repositories
import { userRepository } from "../repositories/user.repository";
import { barangayRepository } from "../repositories/barangay.repository";
import { auditRepository } from "../repositories/audit.repository";
import { notificationRepository } from "../repositories/notification.repository";
import { walletRepository } from "../repositories/wallet.repository";

// Services
import { authService } from "../services/auth.service";
import { verificationService } from "../services/verification.service";
import { adminService } from "../services/admin.service";
import { governanceService } from "../services/governance.service";
import { emailService } from "../services/email.service";
import { inAppWalletService } from "../services/inAppWallet.service";

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  dbUsers: UserProfile[];
  signUpEmailPassword: (email: string, password: string) => Promise<UserProfile>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    middleName: string,
    lastName: string,
    suffix: string,
    birthdate: string,
    barangayId: string,
    barangayName: string,
    barangayMunicipality: string,
    barangayProvince: string,
    desiredRole: "resident" | "barangay_admin",
    mobileNumber: string,
    address: string,
    idType: string,
    idNumber: string,
    schoolName: string,
    professionalInfo?: string,
    adminReason?: string,
    barangayRegion?: string
  ) => Promise<UserProfile>;
  executeAIVerification: (
    idPhotoUrl: string,
    selfiePhotoUrl: string,
    profilePhotoUrl: string,
    overrideProfile?: UserProfile
  ) => Promise<UserProfile>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkWallet: (walletAddress: string, walletProvider: string, signedXdr: string) => Promise<void>;
  unlinkWallet: () => Promise<void>;
  verifyUserInDb: (
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
  ) => Promise<void>;
  refreshUsersList: () => Promise<void>;
  refreshRoles: () => Promise<void>;

  activateBarangay: (
    barangayId: string,
    barangayName: string,
    municipalityName: string,
    provinceName: string,
    regionName: string,
    psgcCode: string,
    zipCode: string
  ) => Promise<void>;
  proposeBarangay?: (name: string, municipality: string, province: string) => Promise<void>;
  approveBarangay?: (id: string) => Promise<void>;
  getApprovedBarangays: () => Promise<Barangay[]>;
  getAllBarangays: () => Promise<Barangay[]>;

  approveBarangayAdmin: (
    adminUid: string,
    barangayId: string,
    barangayName: string,
    municipalityName?: string,
    provinceName?: string,
    regionName?: string,
    zipCode?: string
  ) => Promise<void>;
  suspendBarangayAdmin: (adminUid: string, isSuspend: boolean) => Promise<void>;
  assignSKOfficial: (
    residentUid: string,
    position: "chairman" | "kagawad" | "secretary" | "treasurer",
    termStart: string,
    termEnd: string
  ) => Promise<void>;
  revokeSKOfficial: (residentUid: string) => Promise<void>;
  lockProfileForReview: (targetUid: string, isLock: boolean) => Promise<void>;
  acknowledgeExpiration: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  checkEmailVerificationStatus: () => Promise<boolean>;
  authError: string | null;
  clearAuthError: () => void;
  deleteCurrentUserForResubmission: () => Promise<void>;
  triggerLifecycleEmail: (type: string, recipient: string, data: any) => Promise<void>;
}

const AUTH_SESSION_UID_KEY = "bb_session_uid";
const AUTH_SESSION_EMAIL_KEY = "bb_session_email";
const AUTH_SESSION_LAST_SIGNED_IN_KEY = "bb_session_last_signed_in";
const WALLET_OWNER_UID_KEY = "bb_wallet_owner_uid";
const WALLET_OWNER_ADDRESS_KEY = "bb_wallet_owner_address";
const WALLET_OWNER_PROVIDER_KEY = "bb_wallet_owner_provider";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    logger.setUserContext(profile);
    if (profile) {
      logger.info(`Observability active user context set to: ${profile.email} (${profile.role})`, "AUTH");
    }
  }, [profile]);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (currentUser) {
        try {
          profileUnsubscribe = userRepository.subscribeToUserProfile(
            currentUser.uid,
            async (userProfile) => {
              if (!userProfile) {
                logger.info(`Auth session active but profile missing in Firestore for: ${currentUser.email || currentUser.uid}. User is in onboarding phase.`, "AuthContext");
                setProfile(null);
                return;
              }

              let currentProfile = { ...userProfile };

              // Check dynamic SK Official Term Expiration
              if (currentProfile.role === "sk_official" && currentProfile.termEnd) {
                const today = new Date().toISOString().split("T")[0];
                if (today > currentProfile.termEnd) {
                  logger.warn(`SK term expired for logged-in user ${currentProfile.name} on ${currentProfile.termEnd}. Reverting to Resident...`, "AuthContext");

                  const expiredUpdates = {
                    role: "resident" as const,
                    position: "none" as const,
                    status: "active" as const,
                    permissions: []
                  };

                  await userRepository.updateUserProfile(currentUser.uid, expiredUpdates);
                  await emailService.triggerLifecycleEmail("sk_expired", currentProfile.email, {
                    name: currentProfile.name,
                    barangayName: currentProfile.barangayName
                  });

                  await auditRepository.writeAuditLog({
                    action: "sk_official_expired",
                    category: "Governance",
                    severity: "Warning",
                    actorUid: "system_auto",
                    actorName: "System Automation",
                    actorRole: "system",
                    targetUid: currentUser.uid,
                    targetName: currentProfile.name,
                    targetRole: "resident",
                    barangayId: currentProfile.barangayId,
                    device: "Server/Cron",
                    timestamp: new Date().toISOString(),
                    notes: `SK term for position ${currentProfile.position} expired automatically on ${currentProfile.termEnd}`
                  });

                  await notificationRepository.createNotification({
                    barangayId: currentProfile.barangayId,
                    targetUid: currentUser.uid,
                    title: "SK Official Position Expired",
                    message: `Your term limits for SK ${currentProfile.position} ended on ${currentProfile.termEnd}. Profile role has reverted to Resident.`,
                    createdAt: new Date().toISOString(),
                    read: false
                  });

                  currentProfile = { ...currentProfile, ...expiredUpdates };
                }
              }

              if (!currentProfile.walletAddress || !currentProfile.inAppWalletSecret) {
                currentProfile = await inAppWalletService.ensureUserWallet(currentProfile);
              }

              if (currentProfile.status === "inactive") {
                const reason = currentProfile.verificationNotes || currentProfile.resubmissionReason || currentProfile.autoRejectReason || "Please contact your Barangay Administrator.";
                const message = `Your account is inactive. ${reason}`;
                logger.warn(`Auth session active but status is INACTIVE for: ${currentUser.email || currentUser.uid}. Marking account inactive and preserving session for recovery.`, "AuthContext");
                setAuthError(message);
                setProfile(currentProfile);
              } else {
                setProfile(currentProfile);
                localStorage.setItem(AUTH_SESSION_UID_KEY, currentUser.uid);
                localStorage.setItem(AUTH_SESSION_EMAIL_KEY, currentProfile.email || currentUser.email || "");
                localStorage.setItem(AUTH_SESSION_LAST_SIGNED_IN_KEY, new Date().toISOString());

                if (currentProfile.role === "system_admin" || currentProfile.role === "barangay_admin") {
                  await loadUsersList(currentProfile);
                }
              }
            },
            (err) => {
              logger.error(`Error streaming profile: ${err.message}`, "AuthContext");
            }
          );
        } catch (err) {
          console.error("Error setting up profile snapshot listener:", err);
        }
      } else {
        setProfile(null);
        setDbUsers([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const loadUsersList = async (overrideProfile?: UserProfile) => {
    const activeProfile = overrideProfile || profile;
    if (!activeProfile) return;
    try {
      const list: UserProfile[] = [];

      if (activeProfile.role === "system_admin") {
        logger.database("System Admin: Querying barangay_admin_requests queue", "AuthContext");
        const q = query(collection(db, "barangay_admin_requests"));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          const qEntry = docSnap.data();
          const uSnap = await userRepository.getUserProfile(qEntry.uid);
          if (uSnap) {
            list.push(uSnap);
          }
        }
      } else if (activeProfile.role === "barangay_admin") {
        logger.database(`Barangay Admin: Querying users collection directly for barangay ${activeProfile.barangayId}`, "AuthContext");

        const usersByBgy = await userRepository.queryUsersByBarangay(activeProfile.barangayId);
        usersByBgy.forEach(u => {
          if (!list.some(existing => existing.uid === u.uid)) {
            list.push(u);
          }
        });

        const requestedUsers = await userRepository.queryUsersByRequestedBarangay(activeProfile.barangayId);
        requestedUsers.forEach(u => {
          if (!list.some(existing => existing.uid === u.uid)) {
            list.push(u);
          }
        });
      }

      await governanceService.checkAndDemoteExpiredSKOfficials(list);
      const migratedList = await inAppWalletService.migrateExistingUsers(list);
      setDbUsers(migratedList);
    } catch (err) {
      console.error("Failed to load users from Firestore queues:", err);
    }
  };

  const signUpEmailPassword = async (email: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const initialProfile = await authService.signUpEmailPassword(email, password);
      setProfile(initialProfile);
      return initialProfile;
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    middleName: string,
    lastName: string,
    suffix: string,
    birthdate: string,
    barangayId: string,
    barangayName: string,
    barangayMunicipality: string,
    barangayProvince: string,
    desiredRole: "resident" | "barangay_admin",
    mobileNumber: string,
    address: string,
    idType: string,
    idNumber: string,
    schoolName: string,
    professionalInfo?: string,
    adminReason?: string,
    barangayRegion?: string
  ): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const resProfile = await authService.signUp({
        email, firstName, middleName, lastName, suffix, birthdate, barangayId, barangayName,
        barangayMunicipality, barangayProvince, desiredRole, mobileNumber, address, idType, idNumber,
        schoolName, professionalInfo, adminReason, barangayRegion
      }, password);
      if (resProfile.status !== "inactive") {
        setProfile(resProfile);
      }
      return resProfile;
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const loadedProfile = await authService.signIn(email, password);
      setProfile(loadedProfile);
      if (loadedProfile.role === "system_admin" || loadedProfile.role === "barangay_admin") {
        await loadUsersList(loadedProfile);
      }
    } catch (err: any) {
      if (err.code === "auth/inactive" && err.profile) {
        setProfile(err.profile);
      }
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      try {
        await kitDisconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      purgeAllWalletStorage();
      localStorage.removeItem(AUTH_SESSION_UID_KEY);
      localStorage.removeItem(AUTH_SESSION_EMAIL_KEY);
      localStorage.removeItem(AUTH_SESSION_LAST_SIGNED_IN_KEY);
      setProfile(null);
      setUser(null);
      setDbUsers([]);
      setAuthError(null);
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const executeAIVerification = async (
    idPhotoUrl: string,
    selfiePhotoUrl: string,
    profilePhotoUrl: string,
    overrideProfile?: UserProfile
  ): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    const activeProfile = overrideProfile || profile;
    if (!user || !activeProfile) {
      setLoading(false);
      throw new Error("No authenticated session for identity auditing");
    }
    try {
      const updatedProfile = await verificationService.executeAIVerification(
        user.uid,
        activeProfile,
        idPhotoUrl,
        selfiePhotoUrl,
        profilePhotoUrl
      );
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const linkWallet = async (walletAddress: string, walletProvider: string, signedXdr: string) => {
    if (!user || !profile) throw new Error("User not authenticated");

    logger.debug(`[AuthContext] linkWallet request: Initiating link of address ${walletAddress} (Provider: ${walletProvider}) to UID: ${user.uid}`, "AuthContext");

    if (profile.walletAddress) {
      logger.warn(`[AuthContext] linkWallet rejected: UID ${user.uid} already has linked wallet ${profile.walletAddress}`, "AuthContext");
      throw new Error("A wallet is already linked to this profile. You cannot change your linked wallet.");
    }

    logger.debug(`[AuthContext] linkWallet check: Querying user profiles to ensure ${walletAddress} is not already linked...`, "AuthContext");
    const q = query(collection(db, "users"), where("walletAddress", "==", walletAddress));
    const snap = await getDocs(q);
    const existingLink = snap.docs.find(docSnap => docSnap.id !== user.uid);
    if (existingLink) {
      logger.warn(`[AuthContext] linkWallet rejected: Wallet ${walletAddress} is already linked to another profile (UID: ${existingLink.id})`, "AuthContext");
      throw new Error("This wallet address is already linked to another account.");
    }

    logger.debug(`[AuthContext] linkWallet verify: Running cryptographic check on signed XDR challenge...`, "AuthContext");
    const isValid = verifyWalletLinkSignature(
      signedXdr,
      walletAddress,
      user.uid,
      STELLAR_CONFIG.networkPassphrase
    );

    if (!isValid) {
      logger.error(`[AuthContext] linkWallet failed: Cryptographic signature validation failed for address ${walletAddress} on UID ${user.uid}`, "AuthContext");
      throw new Error("Cryptographic verification failed. Invalid wallet signature proof.");
    }

    logger.success(`[AuthContext] linkWallet verified: Cryptographic signature validated successfully!`, "AuthContext");

    const updates = {
      walletAddress,
      walletProvider,
      walletVerified: true,
      walletLinkedAt: new Date().toISOString(),
      walletSignatureProof: signedXdr
    };

    logger.debug(`[AuthContext] linkWallet db: Writing linked wallet details to Firestore user document users/${user.uid}...`, "AuthContext");
    await userRepository.updateUserProfile(user.uid, updates);

    logger.debug(`[AuthContext] linkWallet db: Indexing wallet connection in wallet_links/${user.uid}...`, "AuthContext");
    await walletRepository.linkWallet(user.uid, walletAddress, walletProvider, signedXdr);

    localStorage.setItem("wallet_address", walletAddress);
    localStorage.setItem("wallet_id", walletProvider);
    localStorage.setItem(WALLET_OWNER_UID_KEY, user.uid);
    localStorage.setItem(WALLET_OWNER_ADDRESS_KEY, walletAddress);
    localStorage.setItem(WALLET_OWNER_PROVIDER_KEY, walletProvider);

    setProfile((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });

    logger.success(`[AuthContext] linkWallet success: Wallet ${walletAddress} is now linked to profile UID: ${user.uid}`, "AuthContext");
  };

  const unlinkWallet = async () => {
    if (!user || !profile) throw new Error("User not authenticated");

    logger.debug(`[AuthContext] unlinkWallet request: Initiating unlink for UID: ${user.uid}`, "AuthContext");

    if (!profile.walletAddress) {
      logger.warn(`[AuthContext] unlinkWallet rejected: UID ${user.uid} does not have a linked wallet`, "AuthContext");
      throw new Error("No wallet is currently linked to this profile.");
    }

    const updates = {
      walletAddress: null,
      walletProvider: null,
      walletVerified: false,
      walletLinkedAt: null,
      walletSignatureProof: null
    };

    logger.debug(`[AuthContext] unlinkWallet db: Removing linked wallet details from Firestore user document users/${user.uid}...`, "AuthContext");
    await userRepository.updateUserProfile(user.uid, updates);

    logger.debug(`[AuthContext] unlinkWallet db: Deleting index from wallet_links/${user.uid}...`, "AuthContext");
    await walletRepository.unlinkWallet(user.uid);

    localStorage.removeItem("wallet_address");
    localStorage.removeItem("wallet_id");
    localStorage.removeItem(WALLET_OWNER_UID_KEY);
    localStorage.removeItem(WALLET_OWNER_ADDRESS_KEY);
    localStorage.removeItem(WALLET_OWNER_PROVIDER_KEY);

    setProfile((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });

    logger.success(`[AuthContext] unlinkWallet success: Wallet unlinked successfully from profile UID: ${user.uid}`, "AuthContext");
  };

  const verifyUserInDb = async (
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
  ) => {
    if (!profile) throw new Error("Not authenticated");
    await adminService.verifyUserInDb(profile, targetUid, role, isVerify, notes, decision);
    await loadUsersList();
  };

  const approveBarangayAdmin = async (
    adminUid: string,
    barangayId: string,
    barangayName: string,
    municipalityName?: string,
    provinceName?: string,
    regionName?: string,
    zipCode?: string
  ) => {
    if (!profile) throw new Error("Not authenticated");
    await adminService.approveBarangayAdmin(profile, adminUid, barangayId, barangayName, municipalityName, provinceName, regionName, zipCode);
    await loadUsersList();
  };

  const suspendBarangayAdmin = async (adminUid: string, isSuspend: boolean) => {
    if (!profile) throw new Error("Not authenticated");
    await adminService.suspendBarangayAdmin(profile, adminUid, isSuspend);
    await loadUsersList();
  };

  const lockProfileForReview = async (targetUid: string, isLock: boolean) => {
    if (!profile) throw new Error("Not authenticated");
    await adminService.lockProfileForReview(profile, targetUid, isLock);
    await loadUsersList();
  };

  const assignSKOfficial = async (
    residentUid: string,
    position: "chairman" | "kagawad" | "secretary" | "treasurer",
    termStart: string,
    termEnd: string
  ) => {
    if (!profile) throw new Error("Not authenticated");
    await governanceService.assignSKOfficial(profile, residentUid, position, termStart, termEnd);
    await loadUsersList();
  };

  const revokeSKOfficial = async (residentUid: string) => {
    if (!profile) throw new Error("Not authenticated");
    await governanceService.revokeSKOfficial(profile, residentUid);
    await loadUsersList();
  };

  const acknowledgeExpiration = async () => {
    if (!user) throw new Error("Not authenticated");
    const updatedProfile = await governanceService.acknowledgeExpiration(user.uid);
    setProfile(updatedProfile);
  };

  const sendVerificationEmail = async () => {
    if (!user) throw new Error("Not authenticated");
    await authService.sendVerificationEmail(user, profile);
  };

  const checkEmailVerificationStatus = async () => {
    if (!user) return false;
    const res = await authService.checkEmailVerificationStatus(user, profile);
    if (res.verified && res.profile) {
      setProfile(res.profile);
      return true;
    }
    return false;
  };

  const deleteCurrentUserForResubmission = async () => {
    await authService.deleteCurrentUserForResubmission();
    setUser(null);
    setProfile(null);
  };

  const triggerLifecycleEmail = async (type: string, recipient: string, data: any) => {
    await emailService.triggerLifecycleEmail(type, recipient, data);
  };

  const activateBarangay = async (
    barangayId: string,
    barangayName: string,
    municipalityName: string,
    provinceName: string,
    regionName: string,
    psgcCode: string,
    zipCode: string
  ) => {
    if (!profile || profile.role !== "system_admin") {
      throw new Error("Only System Admin can activate Barangays");
    }
    await barangayRepository.createBarangayMerge(barangayId, {
      id: barangayId,
      name: barangayName,
      municipality: municipalityName,
      province: provinceName,
      active: true,
      status: "approved",
      psgcCode,
      barangayId,
      barangayName,
      municipalityName,
      provinceName,
      regionName,
      zipCode: zipCode || "4103",
      assignedBarangayAdminUid: null,
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
      activatedBy: profile.uid,
      adminsCount: 0,
      residentsCount: 0,
      projectsCount: 0
    });

    await auditRepository.writeAuditLog({
      action: "barangay_activated",
      category: "Administration",
      severity: "Info",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: barangayId,
      targetName: barangayName,
      targetRole: "barangay",
      barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Activated Barangay Bond Community: ${barangayName} in ${municipalityName}, ${provinceName}`,
      metadata: { barangayId }
    });
  };

  const proposeBarangay = async (name: string, municipality: string, province: string) => {
    await barangayRepository.proposeBarangay(name, municipality, province);
  };

  const approveBarangay = async (id: string) => {
    if (!profile || profile.role !== "system_admin") {
      throw new Error("Only System Admin can approve Barangays");
    }
    const data = await barangayRepository.getBarangay(id);
    if (!data) throw new Error("Barangay not found");

    await barangayRepository.updateBarangay(id, {
      status: "approved",
      active: true,
      approvedAt: new Date().toISOString(),
      approvedBy: profile.uid
    });

    await auditRepository.writeAuditLog({
      action: "barangay_approved",
      category: "Administration",
      severity: "Info",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: id,
      targetName: data.name || data.barangayName || "Unknown Barangay",
      targetRole: "barangay",
      barangayId: id,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Approved Barangay ${data.name || data.barangayName || "Unknown Barangay"}`,
      metadata: { id }
    });
  };

  const getApprovedBarangays = async (): Promise<Barangay[]> => {
    return barangayRepository.getApprovedBarangays();
  };

  const getAllBarangays = async (): Promise<Barangay[]> => {
    return barangayRepository.getAllBarangays();
  };

  const refreshUsersList = async () => {
    await loadUsersList();
  };

  const refreshRoles = async () => {
    if (user) {
      const uSnap = await userRepository.getUserProfile(user.uid);
      if (uSnap) {
        setProfile(uSnap);
      }
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        dbUsers,
        signUpEmailPassword,
        signUp,
        signIn,
        signOut,
        linkWallet,
        unlinkWallet,
        verifyUserInDb,
        refreshUsersList,
        refreshRoles,
        activateBarangay,
        proposeBarangay,
        approveBarangay,
        getApprovedBarangays,
        getAllBarangays,
        authError,
        clearAuthError,
        approveBarangayAdmin,
        suspendBarangayAdmin,
        assignSKOfficial,
        revokeSKOfficial,
        lockProfileForReview,
        acknowledgeExpiration,
        sendVerificationEmail,
        checkEmailVerificationStatus,
        deleteCurrentUserForResubmission,
        triggerLifecycleEmail,
        executeAIVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
