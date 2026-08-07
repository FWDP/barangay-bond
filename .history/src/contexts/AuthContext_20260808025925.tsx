import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
  doc,
  setDoc as rawSetDoc,
  getDoc as rawGetDoc,
  updateDoc as rawUpdateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc as rawAddDoc,
  increment,
  deleteDoc as rawDeleteDoc,
  onSnapshot as rawOnSnapshot,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { GeminiIdentityProvider, checkDuplicates } from "../services/gemini";
import { logger } from "../utils/logger";
import { normalizeName, normalizeAddress, normalizeMobileNumber, normalizeEmail } from "../utils/normalization";
import { STELLAR_CONFIG } from "../configuration/config";
import { verifyWalletLinkSignature } from "../wallet/wallet";
import { DEBUG_MODE } from "../config/debug";


export interface UserProfile {
  uid: string;
  email: string;
  name: string; // display name compatibility
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  displayName: string;
  birthdate: string;
  age: number;
  barangayId: string;
  barangayName: string;
  barangayMunicipality: string;
  barangayProvince: string;
  role: "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer";
  requestedRole: "barangay_admin" | "resident" | "system_admin";
  status: "active" | "inactive" | "suspended" | "expired" | "pending" | "pending_email_verification" | "onboarding";
  position: "chairman" | "kagawad" | "secretary" | "treasurer" | "none";
  permissions: string[];
  walletAddress: string | null;
  walletProvider: string | null;
  walletVerified: boolean;
  walletLinkedAt: string | null;
  verified: boolean;
  verificationStatus: "pending" | "approved" | "rejected" | "auto_rejected" | "ai_verified";
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
  aiDecision?: "auto_accept" | "auto_reject" | "manual_review" | "none";
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

interface AuthContextType {
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
    notes: string
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const registeringEmailRef = React.useRef<string | null>(null);

  // Shadowed logged Firestore wrappers
  const getDoc = async (ref: any): Promise<any> => {
    const startTime = Date.now();
    logger.database(`Firestore Read (getDoc) started: ${ref.path}`, "Firestore");
    try {
      const snap = await rawGetDoc(ref);
      logger.success(`Firestore Read (getDoc) finished: ${ref.path}`, "Firestore", {
        durationMs: Date.now() - startTime,
        metadata: { exists: snap.exists() }
      });
      return snap;
    } catch (err: any) {
      logger.error(`Firestore Read (getDoc) failed: ${ref.path}. Error: ${err.message}`, "Firestore", {
        metadata: { error: err.toString() }
      });
      throw err;
    }
  };

  const setDoc = async (ref: any, data: any, options?: any) => {
    const startTime = Date.now();
    logger.database(`Firestore Write (setDoc) started: ${ref.path}`, "Firestore");
    try {
      if (options) {
        await rawSetDoc(ref, data, options);
      } else {
        await rawSetDoc(ref, data);
      }
      logger.success(`Firestore Write (setDoc) finished: ${ref.path}`, "Firestore", {
        durationMs: Date.now() - startTime
      });
    } catch (err: any) {
      logger.error(`Firestore Write (setDoc) failed: ${ref.path}. Error: ${err.message}`, "Firestore", {
        metadata: { error: err.toString() }
      });
      throw err;
    }
  };

  const updateDoc = async (ref: any, data: any) => {
    const startTime = Date.now();
    logger.database(`Firestore Update (updateDoc) started: ${ref.path}`, "Firestore");
    try {
      await rawUpdateDoc(ref, data);
      logger.success(`Firestore Update (updateDoc) finished: ${ref.path}`, "Firestore", {
        durationMs: Date.now() - startTime,
        metadata: { fields: Object.keys(data) }
      });
    } catch (err: any) {
      logger.error(`Firestore Update (updateDoc) failed: ${ref.path}. Error: ${err.message}`, "Firestore", {
        metadata: { error: err.toString() }
      });
      throw err;
    }
  };

  const addDoc = async (collRef: any, data: any) => {
    const startTime = Date.now();
    logger.database(`Firestore Add (addDoc) started: ${collRef.path}`, "Firestore");
    try {
      const docRef = await rawAddDoc(collRef, data);
      logger.success(`Firestore Add (addDoc) finished: ${docRef.path}`, "Firestore", {
        durationMs: Date.now() - startTime
      });
      return docRef;
    } catch (err: any) {
      logger.error(`Firestore Add (addDoc) failed: ${collRef.path}. Error: ${err.message}`, "Firestore", {
        metadata: { error: err.toString() }
      });
    }
  };

  const deleteDoc = async (ref: any) => {
    const startTime = Date.now();
    logger.database(`Firestore Delete (deleteDoc) started: ${ref.path}`, "Firestore");
    try {
      await rawDeleteDoc(ref);
      logger.success(`Firestore Delete (deleteDoc) finished: ${ref.path}`, "Firestore", {
        durationMs: Date.now() - startTime
      });
    } catch (err: any) {
      logger.error(`Firestore Delete (deleteDoc) failed: ${ref.path}. Error: ${err.message}`, "Firestore", {
        metadata: { error: err.toString() }
      });
      throw err;
    }
  };

  const onSnapshot = (
    ref: any,
    onNext: (snapshot: any) => void,
    onError?: (error: any) => void
  ) => {
    logger.database(`Firestore onSnapshot subscription started: ${ref.path}`, "Firestore");
    return rawOnSnapshot(ref, onNext, onError);
  };

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
        if (registeringEmailRef.current && currentUser.email && registeringEmailRef.current.toLowerCase() === currentUser.email.toLowerCase()) {
          logger.debug(`[AuthContext] onAuthStateChanged: Bypassing profile check for actively registering user ${currentUser.email}`, "AuthContext");
          return;
        }
        try {
          const docRef = doc(db, "users", currentUser.uid);

          profileUnsubscribe = onSnapshot(docRef, async (docSnap) => {
            if (!docSnap.exists()) {
              logger.info(`Auth session active but profile missing in Firestore for: ${currentUser.email || currentUser.uid}. User is in onboarding phase.`, "AuthContext");
              setProfile(null);
              return;
            }

            let userProfile = {
              ...docSnap.data(),
              uid: docSnap.id
            } as UserProfile;

            // Check dynamic SK Official Term Expiration
            if (userProfile.role === "sk_official" && userProfile.termEnd) {
              const today = new Date().toISOString().split("T")[0];
              if (today > userProfile.termEnd) {
                logger.warn(`SK term expired for logged-in user ${userProfile.name} on ${userProfile.termEnd}. Reverting to Resident...`, "AuthContext");

                const expiredUpdates = {
                  role: "resident" as const,
                  position: "none" as const,
                  status: "active" as const,
                  permissions: []
                };

                await updateDoc(docRef, expiredUpdates);

                await triggerLifecycleEmail("sk_expired", userProfile.email, {
                  name: userProfile.name,
                  barangayName: userProfile.barangayName
                });

                // Write Audit Log
                await addDoc(collection(db, "audit_logs"), {
                  action: "sk_official_expired",
                  category: "Governance",
                  severity: "Warning",
                  actorUid: "system_auto",
                  actorName: "System Automation",
                  actorRole: "system",
                  targetUid: currentUser.uid,
                  targetName: userProfile.name,
                  targetRole: "resident",
                  barangayId: userProfile.barangayId,
                  device: "Server/Cron",
                  timestamp: new Date().toISOString(),
                  notes: `SK term for position ${userProfile.position} expired automatically on ${userProfile.termEnd}`
                });

                // Write Notification
                await addDoc(collection(db, "notifications"), {
                  barangayId: userProfile.barangayId,
                  targetUid: currentUser.uid,
                  title: "SK Official Position Expired",
                  message: `Your term limits for SK ${userProfile.position} ended on ${userProfile.termEnd}. Profile role has reverted to Resident.`,
                  createdAt: new Date().toISOString(),
                  read: false
                });

                userProfile = { ...userProfile, ...expiredUpdates };
              }
            }

            if (userProfile.status === "inactive") {
              const reason = userProfile.verificationNotes || userProfile.autoRejectReason || "Please contact your Barangay Administrator.";
              const message = `Your account is inactive. ${reason}`;
              logger.warn(`Auth session active but status is INACTIVE for: ${currentUser.email || currentUser.uid}. Auto-signing out.`, "AuthContext");
              setAuthError(message);
              await firebaseSignOut(auth);
              setUser(null);
              setProfile(null);
            } else {
              setProfile(userProfile);
              await saveSessionInfo(currentUser.uid);

              if (userProfile.role === "system_admin" || userProfile.role === "barangay_admin") {
                await loadUsersList(userProfile);
              }
            }
          }, (err) => {
            logger.error(`Error streaming profile: ${err.message}`, "AuthContext");
          });
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

  const saveSessionInfo = async (uid: string) => {
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

      const sessionRef = collection(db, "sessions");
      await addDoc(sessionRef, {
        uid,
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
  };

  const checkAndDemoteExpiredSKOfficials = async (usersList: UserProfile[]) => {
    const today = new Date().toISOString().split("T")[0];
    let didUpdate = false;

    for (const u of usersList) {
      if (u.role === "sk_official" && u.status === "active" && u.termEnd) {
        if (today > u.termEnd) {
          logger.info(`SK Official term expired for ${u.name} (Term End: ${u.termEnd}). Reverting to active Resident status.`, "AuthContext");
          try {
            const userRef = doc(db, "users", u.uid);
            const expiredUpdates = {
              role: "resident" as const,
              position: "none" as const,
              status: "active" as const,
              permissions: []
            };
            await updateDoc(userRef, expiredUpdates);

            // Create notification
            await addDoc(collection(db, "notifications"), {
              targetUid: u.uid,
              title: "SK Official Position Expired",
              message: `Your term as SK ${u.position.toUpperCase()} has expired on ${u.termEnd}. Reverted back to resident.`,
              createdAt: new Date().toISOString(),
              read: false
            });

            // Write Audit Log
            await addDoc(collection(db, "audit_logs"), {
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
            logger.error(`Automatic demotion failed for ${u.name}: ${err.message}`, "AuthContext");
          }
        }
      }
    }
    return didUpdate;
  };

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
          const userRef = doc(db, "users", qEntry.uid);
          const uSnap = await getDoc(userRef);
          if (uSnap.exists()) {
            list.push(uSnap.data() as UserProfile);
          }
        }
      } else if (activeProfile.role === "barangay_admin") {
        logger.database(`Barangay Admin: Querying users collection directly for barangay ${activeProfile.barangayId}`, "AuthContext");

        // Query users whose current barangay matches
        const qUsers = query(
          collection(db, "users"),
          where("barangayId", "==", activeProfile.barangayId)
        );
        const snapUsers = await getDocs(qUsers);
        snapUsers.forEach(docSnap => {
          const u = docSnap.data() as UserProfile;
          if (!list.some(existing => existing.uid === u.uid)) {
            list.push(u);
          }
        });

        // Query users whose requested barangay matches (e.g. pending co-admins)
        const qRequested = query(
          collection(db, "users"),
          where("requestedBarangayId", "==", activeProfile.barangayId)
        );
        const snapRequested = await getDocs(qRequested);
        snapRequested.forEach(docSnap => {
          const u = docSnap.data() as UserProfile;
          if (!list.some(existing => existing.uid === u.uid)) {
            list.push(u);
          }
        });
      }

      await checkAndDemoteExpiredSKOfficials(list);
      setDbUsers([...list]);
    } catch (err) {
      console.error("Failed to load users from Firestore queues:", err);
    }
  };

  const signUpEmailPassword = async (email: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    const correlationId = `AUTH-INIT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    logger.auth(`Starting initial Auth account creation for: ${email}`, "AuthContext", { correlationId });

    const normalizedEmail = normalizeEmail(email);
    registeringEmailRef.current = normalizedEmail;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      const uid = userCredential.user.uid;

      logger.auth("Sending Firebase verification email...", "AuthContext");
      await sendEmailVerification(userCredential.user);

      await triggerLifecycleEmail("verify_email", normalizedEmail, { name: "Valued Resident" });

      setProfile(null);
      setUser(userCredential.user);

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

      return initialProfile;
    } catch (err: any) {
      logger.error(`Initial account creation failed: ${err.message}`, "AuthContext", { correlationId });
      if (err.code === "auth/email-already-in-use" || err.message?.includes("email-already-in-use")) {
        try {
          const usersQuery = query(collection(db, "users"), where("email", "==", normalizedEmail));
          const usersSnapshot = await getDocs(usersQuery);
          if (!usersSnapshot.empty) {
            const existingProfile = usersSnapshot.docs[0].data() as UserProfile;
            const reason = existingProfile.verificationNotes || existingProfile.autoRejectReason || "Please contact your Barangay Administrator.";
            const duplicateErr = new Error(`This email is already registered. Your previous account is currently inactive or rejected. ${reason}`);
            (duplicateErr as any).code = "auth/email-already-in-use";
            throw duplicateErr;
          }
        } catch (queryErr: any) {
          logger.error(`Failed to inspect existing user profile for email conflict: ${queryErr?.message || queryErr}`, "AuthContext", { correlationId });
        }
      }
      throw err;
    } finally {
      registeringEmailRef.current = null;
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
    const correlationId = `AUTH-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const startTime = Date.now();

    // Reassign arguments with normalized inputs
    email = normalizeEmail(email);
    firstName = normalizeName(firstName);
    middleName = normalizeName(middleName);
    lastName = normalizeName(lastName);
    suffix = normalizeName(suffix);
    mobileNumber = normalizeMobileNumber(mobileNumber);
    address = normalizeAddress(address);

    const displayName = `${firstName} ${middleName ? middleName + " " : ""}${lastName}${suffix ? " " + suffix : ""}`;
    const name = displayName;

    logger.auth(`Registration signUp request started for: ${email} (${desiredRole})`, "AuthContext", {
      correlationId,
      metadata: { name, birthdate, barangayName, idType, idNumber }
    });

    try {
      // Age checks for resident
      let age = 0;
      if (desiredRole === "resident") {
        const today = new Date();
        const birth = new Date(birthdate);
        age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        logger.debug(`Layer 1 rule validation: Calculated resident age is ${age} yrs`, "AuthContext", { correlationId });
        if (age < 15) {
          logger.warn(`Layer 1 rule validation failed: Age ${age} below minimum requirement (15).`, "AuthContext", { correlationId });
          throw new Error("Age validation failed. Residents must be at least 15 years old.");
        }
      }

      // Only residents need an approved barangay — barangay_admin will be assigned one later by System Admin
      if (desiredRole === "resident") {
        const docRef = doc(db, "barangays", barangayId);
        logger.database(`Reading barangays/${barangayId} from Firestore`, "AuthContext", { correlationId });
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || (docSnap.data().status !== "approved" && docSnap.data().active !== true)) {
          logger.warn(`Layer 1 rule validation failed: Selected barangay ${barangayId} is inactive/unapproved.`, "AuthContext", { correlationId });
          throw new Error("Selected barangay is no longer active or approved.");
        }
      }

      let uid = "";
      let userCredentialObj = null;

      if (auth.currentUser) {
        uid = auth.currentUser.uid;
        logger.debug(`Found existing active auth session for ${email}. Bypassing createUserWithEmailAndPassword.`, "AuthContext", { correlationId });
      } else {
        logger.debug("Creating Firebase Auth credential...", "AuthContext", { correlationId });
        registeringEmailRef.current = email;
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        userCredentialObj = userCredential;
        uid = userCredential.user.uid;
      }

      try {
        let initialRole: "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer" = desiredRole;
        let isEmailVerified = auth.currentUser ? auth.currentUser.emailVerified : false;
        let initialStatus: "active" | "inactive" | "suspended" | "expired" | "pending" | "pending_email_verification" | "onboarding" = isEmailVerified ? "pending" : "pending_email_verification";
        let initialVerified = false;
        let initialVerStatus: "pending" | "approved" | "rejected" | "auto_rejected" | "ai_verified" = "pending";
        let initialPermissions: string[] = [];

        // Overwrite for Age > 30 resident: register as Viewer instead
        if (desiredRole === "resident" && age > 30) {
          logger.info(`Resident age ${age} > 30. Redirecting signup to Viewer role.`, "AuthContext", { correlationId });
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
          birthdate,
          age,
          barangayId: desiredRole === "barangay_admin" ? "unassigned" : barangayId,
          barangayName: desiredRole === "barangay_admin" ? "Unassigned" : barangayName,
          barangayMunicipality: desiredRole === "barangay_admin" ? "N/A" : barangayMunicipality,
          barangayProvince: desiredRole === "barangay_admin" ? "N/A" : barangayProvince,
          barangayRegion: desiredRole === "resident" ? (barangayRegion || "N/A") : "N/A",
          requestedBarangayId: desiredRole === "barangay_admin" ? (barangayId || "N/A") : "N/A",
          requestedBarangayName: desiredRole === "barangay_admin" ? (barangayName || "N/A") : "N/A",
          requestedMunicipalityName: desiredRole === "barangay_admin" ? (barangayMunicipality || "N/A") : "N/A",
          requestedProvinceName: desiredRole === "barangay_admin" ? (barangayProvince || "N/A") : "N/A",
          requestedRegionName: desiredRole === "barangay_admin" ? (barangayRegion || "N/A") : "N/A",
          role: initialRole,
          requestedRole: desiredRole,
          status: initialStatus,
          position: "none",
          permissions: initialPermissions,
          walletAddress: null,
          walletProvider: null,
          walletVerified: false,
          walletLinkedAt: null,
          verified: initialVerified,
          verificationStatus: initialVerStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          mobileNumber,
          address,
          idType,
          idNumber,
          schoolName,
          idPhotoUrl: "N/A",
          selfiePhotoUrl: "N/A",
          professionalInfo: professionalInfo || "N/A",
          adminReason: adminReason || "N/A",
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

        logger.database(`Writing users/${uid} to Firestore`, "AuthContext", { correlationId });
        await setDoc(doc(db, "users", uid), newProfile);

        if (newProfile.status === "pending_email_verification") {
          logger.auth("Sending Firebase verification email...", "AuthContext");
          const targetUser = userCredentialObj ? userCredentialObj.user : auth.currentUser;
          if (targetUser) {
            await sendEmailVerification(targetUser);
            await updateDoc(doc(db, "users", uid), {
              verificationEmailSentAt: new Date().toISOString()
            });

            await triggerLifecycleEmail("registration_submitted", email, {
              name,
              role: desiredRole,
              barangayName: desiredRole === "barangay_admin" ? "Unassigned" : barangayName
            });
            await triggerLifecycleEmail("verify_email", email, { name });
          }
        } else {
          // Trigger the lifecycle email for registration submitted since email is already verified
          await triggerLifecycleEmail("registration_submitted", email, {
            name,
            role: desiredRole,
            barangayName: desiredRole === "barangay_admin" ? "Unassigned" : barangayName
          });
        }

        // Set local profile so it updates immediately in the UI state without waiting for onAuthStateChanged hook
        if (newProfile.status !== "inactive") {
          setProfile(newProfile);
          if (userCredentialObj) {
            setUser(userCredentialObj.user);
          }
        }

        logger.success(`Registration complete for ${email}. Status: ${newProfile.status}`, "AuthContext", {
          correlationId,
          durationMs: Date.now() - startTime
        });
        return newProfile;
      } catch (innerErr) {
        if (auth.currentUser && !userCredentialObj) {
          logger.warn(`Inner registration steps failed for existing user. Keeping session active.`, "AuthContext", { correlationId });
        } else if (auth.currentUser) {
          logger.warn(`Inner registration steps failed. Cleaning up auth session...`, "AuthContext", { correlationId });
          try {
            await firebaseSignOut(auth);
          } catch (e) { }
        }
        throw innerErr;
      } finally {
        registeringEmailRef.current = null;
      }
    } catch (err: any) {
      logger.error(`Registration failed: ${err.message}`, "AuthContext", { correlationId });
      setLoading(false);
      throw err;
    }
  };

  const executeAIVerification = async (
    idPhotoUrl: string,
    selfiePhotoUrl: string,
    profilePhotoUrl: string,
    overrideProfile?: UserProfile
  ): Promise<UserProfile> => {
    setLoading(true);
    const correlationId = `AI-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const startTime = Date.now();

    const activeProfile = overrideProfile || profile;
    if (!user || !activeProfile) {
      throw new Error("No authenticated session for identity auditing");
    }
    const uid = user.uid;

    logger.auth(`Starting identity visual audit for user: ${uid}`, "AuthContext", { correlationId });

    try {
      // 1. Upload assets to Firestore documents (base64 compressed strings)
      logger.info(`Storing compressed documents for ${uid}...`, "AuthContext", { correlationId });
      await setDoc(doc(db, "uploaded_documents", `${uid}_id`), {
        uid,
        documentType: activeProfile.idType,
        storagePath: `database/${uid}/id_photo`,
        base64Url: idPhotoUrl,
        hash: `${uid}_id_hash`,
        uploadedAt: new Date().toISOString()
      });

      let storageSelfieUrl = "N/A";
      if (selfiePhotoUrl && selfiePhotoUrl !== "N/A") {
        storageSelfieUrl = selfiePhotoUrl;
        await setDoc(doc(db, "uploaded_documents", `${uid}_selfie`), {
          uid,
          documentType: "selfie_holding_id",
          storagePath: `database/${uid}/selfie_photo`,
          base64Url: selfiePhotoUrl,
          hash: `${uid}_selfie_hash`,
          uploadedAt: new Date().toISOString()
        });
      }

      let storageProfileUrl = "N/A";
      if (profilePhotoUrl && profilePhotoUrl !== "N/A") {
        storageProfileUrl = profilePhotoUrl;
        await setDoc(doc(db, "uploaded_documents", `${uid}_avatar`), {
          uid,
          documentType: "profile_avatar",
          storagePath: `database/${uid}/avatar`,
          base64Url: profilePhotoUrl,
          hash: `${uid}_avatar_hash`,
          uploadedAt: new Date().toISOString()
        });
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
        logger.info(`Layer 2 duplicate scan finished. Max similarity match: ${dupResult.maxScore}%`, "AuthContext", { correlationId });
      } catch (dupError: any) {
        logger.warn(`Duplicate check failed/bypassed: ${dupError.message}`, "AuthContext");
      }

      const hasExactDuplicate = dupResult.matches.length > 0 && dupResult.matches.some((m: any) => m.similarity >= 95);

      const updatedProfile = { ...activeProfile };
      updatedProfile.idPhotoUrl = idPhotoUrl;
      updatedProfile.selfiePhotoUrl = storageSelfieUrl;
      updatedProfile.profilePhotoUrl = storageProfileUrl;
      updatedProfile.photoURL = storageProfileUrl === "N/A" ? "" : storageProfileUrl;

      let aiResult: any = null;

      if (hasExactDuplicate) {
        logger.warn(`Duplicate check failed: Exact match exists.`, "AuthContext", { correlationId });
        updatedProfile.verificationStatus = "auto_rejected";
        updatedProfile.status = "pending";
        updatedProfile.aiDecision = "auto_reject";
        updatedProfile.riskScore = 100;
        updatedProfile.duplicateScore = dupResult.maxScore;
        updatedProfile.autoRejectReason = "Exact duplicate identity or ID number found in database.";
      } else {
        logger.ai(`Layer 3: Triggering Gemini Vision visual check...`, "AuthContext", { correlationId });
        const geminiProvider = new GeminiIdentityProvider();
        try {
          aiResult = await geminiProvider.analyzeIdentity({
            name: activeProfile.name,
            birthdate: activeProfile.birthdate,
            address: activeProfile.address,
            barangayName: activeProfile.barangayName,
            municipality: activeProfile.barangayMunicipality,
            province: activeProfile.barangayProvince,
            idType: activeProfile.idType,
            idNumber: activeProfile.idNumber,
            imageDataUrl: idPhotoUrl
          });

          logger.success("Layer 3 Gemini Vision returned structured JSON extraction successfully", "AuthContext", {
            correlationId,
            metadata: aiResult
          });

          if (aiResult.confidence < 50) {
            logger.warn(`AI score ${aiResult.confidence}% is below threshold. Deleting user session...`, "AuthContext");

            await deleteDoc(doc(db, "uploaded_documents", `${uid}_id`));
            if (selfiePhotoUrl && selfiePhotoUrl !== "N/A") {
              await deleteDoc(doc(db, "uploaded_documents", `${uid}_selfie`));
            }
            if (profilePhotoUrl && profilePhotoUrl !== "N/A") {
              await deleteDoc(doc(db, "uploaded_documents", `${uid}_avatar`));
            }
            await deleteDoc(doc(db, "users", uid));
            if (auth.currentUser) {
              await auth.currentUser.delete();
            }
            setUser(null);
            setProfile(null);

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

          if (isAutoReject) {
            logger.warn(`AI Analysis triggered AUTO_REJECT recommendation`, "AuthContext", { correlationId });
            updatedProfile.verificationStatus = "auto_rejected";
            updatedProfile.status = "pending";
            updatedProfile.aiDecision = "auto_reject";
            updatedProfile.riskScore = aiResult.riskScore;
            updatedProfile.autoRejectReason = aiResult.reasons.join(", ") || "Failed document quality or authenticity check.";
          } else if (activeProfile.requestedRole === "barangay_admin") {
            logger.info(`AI analysis evaluated for Barangay Admin. Queueing for System Admin review.`, "AuthContext", { correlationId });
            updatedProfile.verificationStatus = "pending";
            updatedProfile.status = "pending";
            updatedProfile.aiDecision = (aiResult.recommendation === "AUTO_ACCEPT" && aiResult.riskScore === 0 && aiResult.confidence >= 99)
              ? "auto_accept"
              : "manual_review";
            updatedProfile.riskScore = aiResult.riskScore;
          } else {
            if (
              aiResult.recommendation === "AUTO_ACCEPT" &&
              aiResult.riskScore === 0 &&
              aiResult.confidence >= 99 &&
              dupResult.maxScore < 70
            ) {
              logger.success(`AI Analysis triggered AUTO_ACCEPT fast-track recommendation`, "AuthContext", { correlationId });
              updatedProfile.verificationStatus = "ai_verified";
              updatedProfile.aiDecision = "auto_accept";
              updatedProfile.riskScore = 0;
            } else {
              logger.info(`AI Analysis queued profile for MANUAL_REVIEW`, "AuthContext", { correlationId });
              updatedProfile.verificationStatus = "pending";
              updatedProfile.aiDecision = "manual_review";
              updatedProfile.riskScore = aiResult.riskScore;
            }
          }

          const verificationId = `${uid}_${Date.now()}`;
          await setDoc(doc(db, "ai_verifications", verificationId), {
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
          });

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
          logger.error(`Gemini verification error, falling back: ${geminiError.message}`, "AuthContext", { correlationId });
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

      logger.database(`Updating users/${uid} with AI verification results in Firestore`, "AuthContext", { correlationId });
      await setDoc(doc(db, "users", uid), updatedProfile);

      await triggerLifecycleEmail("ai_completed", activeProfile.email, {
        name: activeProfile.name,
        confidence: aiResult ? aiResult.confidence : 0,
        decision: aiResult ? aiResult.recommendation : "AUTO_REJECT"
      });

      await setDoc(doc(db, "wallet_links", uid), {
        uid,
        wallet: "",
        verified: false,
        linkedAt: ""
      });

      if (activeProfile.requestedRole === "barangay_admin") {
        logger.database(`Adding ${uid} to barangay_admin_requests queue`, "AuthContext", { correlationId });
        await setDoc(doc(db, "barangay_admin_requests", uid), {
          uid,
          barangayId: "unassigned",
          status: "pending",
          submittedAt: new Date().toISOString(),
          approvedBy: null
        });
      } else if (activeProfile.requestedRole === "resident") {
        logger.database(`Adding ${uid} to resident_verification_queue`, "AuthContext", { correlationId });
        await setDoc(doc(db, "resident_verification_queue", uid), {
          uid,
          barangayId: activeProfile.barangayId,
          status: "pending",
          submittedAt: new Date().toISOString(),
          aiRisk: updatedProfile.aiDecision || "pending",
          duplicate: updatedProfile.duplicateRisk || false
        });
      }

      if (typeof dupResult !== "undefined" && dupResult.matches && dupResult.matches.length > 0) {
        updatedProfile.duplicateRisk = true;
        for (const match of dupResult.matches) {
          const reportId = `${uid}_${match.userId}`;
          await setDoc(doc(db, "duplicate_reports", reportId), {
            userId: uid,
            matchedUser: match.userId,
            reason: match.matchedFields.join(", "),
            similarity: match.similarity,
            status: "pending"
          });
        }
      }

      setProfile(updatedProfile);
      setLoading(false);
      logger.success(`Identity verification completed for ${activeProfile.email}. Status: ${updatedProfile.status}`, "AuthContext", {
        correlationId,
        durationMs: Date.now() - startTime
      });
      return updatedProfile;

    } catch (err: any) {
      logger.error(`executeAIVerification failed: ${err.message}`, "AuthContext", { correlationId });
      setLoading(false);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const correlationId = `AUTH-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const startTime = Date.now();
    logger.auth(`Login request started for: ${email}`, "AuthContext", { correlationId });

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const docSnap = await getDoc(doc(db, "users", userCredential.user.uid));
      if (docSnap.exists()) {
        const loadedProfile = docSnap.data() as UserProfile;

        if (loadedProfile.status === "suspended") {
          logger.warn(`Login rejected: User ${email} is suspended`, "AuthContext", { correlationId });
          await firebaseSignOut(auth);
          const err = new Error("Your account has been suspended by the platform administrator.");
          (err as any).code = "auth/suspended";
          throw err;
        }

        if (loadedProfile.status === "inactive") {
          logger.warn(`Login rejected: User ${email} is inactive`, "AuthContext", { correlationId });
          await firebaseSignOut(auth);
          const reason = loadedProfile.verificationNotes || loadedProfile.autoRejectReason || "Please contact your Barangay Administrator.";
          const err = new Error(`Your account is inactive. ${reason}`);
          (err as any).code = "auth/inactive";
          throw err;
        }

        setProfile(loadedProfile);
        logger.success(`Login successful for ${email}`, "AuthContext", {
          correlationId,
          durationMs: Date.now() - startTime
        });

        if (loadedProfile.role === "system_admin" || loadedProfile.role === "barangay_admin") {
          await loadUsersList(loadedProfile);
        }
        setLoading(false);
      }
    } catch (err: any) {
      logger.error(`Login failed for ${email}: ${err.message}`, "AuthContext", {
        correlationId,
        metadata: { error: err.toString() }
      });
      setLoading(false);
      throw err;
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const signOut = async () => {
    setLoading(true);
    const email = profile?.email || "Guest";
    logger.auth(`Signing out user: ${email}`, "AuthContext");
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setDbUsers([]);
    setAuthError(null);
    setLoading(false);
    logger.success(`Sign out complete for ${email}`, "AuthContext");
  };

  const linkWallet = async (walletAddress: string, walletProvider: string, signedXdr: string) => {
    if (!user || !profile) throw new Error("User not authenticated");

    logger.debug(`[AuthContext] linkWallet request: Initiating link of address ${walletAddress} (Provider: ${walletProvider}) to UID: ${user.uid}`, "AuthContext");

    if (profile.walletAddress) {
      logger.warn(`[AuthContext] linkWallet rejected: UID ${user.uid} already has linked wallet ${profile.walletAddress}`, "AuthContext");
      throw new Error("A wallet is already linked to this profile. You cannot change your linked wallet.");
    }

    // Query if the wallet is already linked to another user
    logger.debug(`[AuthContext] linkWallet check: Querying user profiles to ensure ${walletAddress} is not already linked...`, "AuthContext");
    const q = query(
      collection(db, "users"),
      where("walletAddress", "==", walletAddress)
    );
    const snap = await getDocs(q);
    const existingLink = snap.docs.find(docSnap => docSnap.id !== user.uid);
    if (existingLink) {
      logger.warn(`[AuthContext] linkWallet rejected: Wallet ${walletAddress} is already linked to another profile (UID: ${existingLink.id})`, "AuthContext");
      throw new Error("This wallet address is already linked to another account.");
    }

    // Cryptographically verify signature
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

    const docRef = doc(db, "users", user.uid);
    const updates = {
      walletAddress,
      walletProvider,
      walletVerified: true,
      walletLinkedAt: new Date().toISOString(),
      walletSignatureProof: signedXdr
    };

    logger.debug(`[AuthContext] linkWallet db: Writing linked wallet details to Firestore user document users/${user.uid}...`, "AuthContext");
    await updateDoc(docRef, updates);

    // Also update wallet links collection
    logger.debug(`[AuthContext] linkWallet db: Indexing wallet connection in wallet_links/${user.uid}...`, "AuthContext");
    await setDoc(doc(db, "wallet_links", user.uid), {
      uid: user.uid,
      wallet: walletAddress,
      verified: true,
      linkedAt: new Date().toISOString(),
      signatureProof: signedXdr
    });

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

    const docRef = doc(db, "users", user.uid);
    const updates = {
      walletAddress: null,
      walletProvider: null,
      walletVerified: false,
      walletLinkedAt: null,
      walletSignatureProof: null
    };

    logger.debug(`[AuthContext] unlinkWallet db: Removing linked wallet details from Firestore user document users/${user.uid}...`, "AuthContext");
    await rawUpdateDoc(docRef, updates);

    // Delete from wallet links index collection
    logger.debug(`[AuthContext] unlinkWallet db: Deleting index from wallet_links/${user.uid}...`, "AuthContext");
    await rawDeleteDoc(doc(db, "wallet_links", user.uid));

    setProfile((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });

    logger.success(`[AuthContext] unlinkWallet success: Wallet unlinked successfully from profile UID: ${user.uid}`, "AuthContext");
  };

  const lockProfileForReview = async (targetUid: string, isLock: boolean) => {
    if (!profile || (profile.role !== "barangay_admin" && profile.role !== "system_admin")) {
      throw new Error("Only authorized admins can lock profiles");
    }

    const targetRef = doc(db, "users", targetUid);
    await updateDoc(targetRef, {
      currentlyReviewedBy: isLock ? profile.name : null,
      reviewStartedAt: isLock ? new Date().toISOString() : null
    });

    await loadUsersList();
  };

  const verifyUserInDb = async (
    targetUid: string,
    role: "sk" | "youth",
    isVerify: boolean,
    notes: string
  ) => {
    // Console debugger and detailed diagnostic logs
    console.debug("[verifyUserInDb] Execution initiated", { targetUid, role, isVerify, notes });
    logger.debug(`[verifyUserInDb] Execution initiated for target: ${targetUid}, verify: ${isVerify}`, "AuthContext", { metadata: { role, notes } });
    if (DEBUG_MODE) {
      console.log("%c[verifyUserInDb] Debug Mode Active. Execution paused.", "color: #38bdf8; font-weight: bold;");
      debugger;
    }

    if (!profile || (profile.role !== "barangay_admin" && profile.role !== "system_admin")) {
      throw new Error("Only Barangay Admin or System Admin can verify users");
    }

    const targetRef = doc(db, "users", targetUid);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error("Resident not found");
    const targetData = targetSnap.data() as UserProfile;

    // Enforce Barangay boundary check ONLY for Barangay Admins (System Admins have global permission)
    if (profile.role === "barangay_admin" && targetData.barangayId !== profile.barangayId) {
      throw new Error("Cannot verify resident outside your assigned Barangay");
    }

    // Determine if the target user is applying for an administrative role (barangay_admin or system_admin)
    const isApplyingForAdmin = targetData.requestedRole === "barangay_admin" ||
      targetData.requestedRole === "system_admin" ||
      targetData.role === "barangay_admin" ||
      targetData.role === "system_admin";

    const targetRoleName = role === "sk" ? "sk_official" : "resident";

    const updates = {
      verified: isVerify,
      verificationStatus: isVerify ? ("approved" as const) : ("rejected" as const),
      role: isVerify
        ? (targetRoleName as any)
        : (isApplyingForAdmin ? ("viewer" as any) : ("resident" as any)),
      status: isVerify
        ? ("pending_email_verification" as const)
        : (isApplyingForAdmin ? ("active" as const) : ("inactive" as const)),
      activationStatus: isVerify
        ? ("pending_email_verification" as const)
        : (isApplyingForAdmin ? ("active" as const) : ("inactive" as const)),
      emailVerified: false,
      approvedAt: isVerify ? new Date().toISOString() : null,
      approvedBy: isVerify ? profile.uid : null,
      verificationEmailSentAt: null,
      activatedAt: null,
      verificationNotes: notes,
      verifiedBy: profile.email || "admin",
      verifiedAt: new Date().toISOString(),
      currentlyReviewedBy: null,
      reviewStartedAt: null
    };
    await updateDoc(targetRef, updates);

    // Update queue request document
    if (isApplyingForAdmin) {
      try {
        const requestRef = doc(db, "barangay_admin_requests", targetUid);
        await updateDoc(requestRef, {
          status: isVerify ? "approved" : "rejected",
          approvedBy: isVerify ? profile.uid : null,
          rejectedBy: isVerify ? null : profile.uid
        });
      } catch (e) {
        // Ignored if request doc is not present
      }
    } else {
      const queueRef = doc(db, "resident_verification_queue", targetUid);
      await updateDoc(queueRef, {
        status: isVerify ? "approved" : "rejected"
      });
    }

    if (isVerify && !isApplyingForAdmin) {
      const barangayRef = doc(db, "barangays", targetData.barangayId);
      await updateDoc(barangayRef, {
        residentsCount: increment(1)
      });
    }

    const actionName = isVerify
      ? (isApplyingForAdmin ? "barangay_admin_approved" : "resident_approved")
      : (isApplyingForAdmin ? "barangay_admin_rejected" : "resident_rejected");

    // Rich Category/Severity Audit Logs
    await addDoc(collection(db, "audit_logs"), {
      action: actionName,
      category: "Verification",
      severity: isVerify ? "Info" : "Warning",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: targetUid,
      targetName: targetData.name,
      targetRole: isVerify ? (isApplyingForAdmin ? "barangay_admin" : targetRoleName) : (isApplyingForAdmin ? "viewer" : "resident"),
      barangayId: targetData.barangayId || profile.barangayId || "N/A",
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: isVerify
        ? (isApplyingForAdmin ? `Assigned as admin. Remarks: ${notes}` : `Residency verified. Remarks: ${notes}`)
        : (isApplyingForAdmin ? `Admin application rejected. Reverted to Viewer. Reason: ${notes}` : `Verification rejected. Reason: ${notes}`),
      metadata: { targetMobile: targetData.mobileNumber || "N/A" }
    });

    await addDoc(collection(db, "notifications"), {
      barangayId: targetData.barangayId || profile.barangayId || "N/A",
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
    });

    await loadUsersList();

    if (isVerify) {
      await triggerLifecycleEmail("approved", targetData.email, { name: targetData.name });
    } else {
      await triggerLifecycleEmail("rejected", targetData.email, { name: targetData.name, reason: notes });
    }
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
    if (!profile || (profile.role !== "system_admin" && profile.role !== "barangay_admin")) {
      throw new Error("Only System Admin or an existing Barangay Admin can approve Barangay Admins");
    }

    if (profile.role === "barangay_admin" && profile.barangayId !== barangayId) {
      throw new Error("You can only approve administrators for your own Barangay");
    }

    const targetRef = doc(db, "users", adminUid);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error("Admin profile not found");
    const targetData = targetSnap.data() as UserProfile;

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
      approvedBy: profile.uid,
      approvedAt: new Date().toISOString(),
      permissions: ["verify_residents", "assign_sk"]
    };
    await updateDoc(targetRef, updates);

    // Save/update complete barangay document snapshot in Firestore
    const barangayRef = doc(db, "barangays", barangayId);
    await setDoc(barangayRef, {
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
      activatedBy: profile.uid,
      adminsCount: increment(1)
    }, { merge: true });

    // Update queue request document if present
    try {
      const requestRef = doc(db, "barangay_admin_requests", adminUid);
      await updateDoc(requestRef, {
        status: "approved",
        approvedBy: profile.uid
      });
    } catch (e) {
      // Ignored if request doc is not present
    }

    await addDoc(collection(db, "audit_logs"), {
      action: "barangay_admin_approved",
      category: "Verification",
      severity: "Info",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: adminUid,
      targetName: targetData.name,
      targetRole: "barangay_admin",
      barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Assigned as admin for Barangay ${barangayName}`,
      metadata: { barangayId }
    });

    await addDoc(collection(db, "notifications"), {
      barangayId,
      targetUid: adminUid,
      title: "Barangay Admin Approved",
      message: `Your application has been approved. You are now the assigned admin for Barangay ${barangayName}.`,
      createdAt: new Date().toISOString(),
      read: false
    });

    await loadUsersList();

    await triggerLifecycleEmail("approved", targetData.email, { name: targetData.name });
  };

  const suspendBarangayAdmin = async (adminUid: string, isSuspend: boolean) => {
    if (!profile || profile.role !== "system_admin") {
      throw new Error("Only System Admin can suspend Barangay Admins");
    }

    const targetRef = doc(db, "users", adminUid);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error("Admin profile not found");
    const targetData = targetSnap.data() as UserProfile;

    await updateDoc(targetRef, {
      status: isSuspend ? "suspended" : "active"
    });

    await addDoc(collection(db, "audit_logs"), {
      action: isSuspend ? "barangay_admin_suspended" : "barangay_admin_reactivated",
      category: "Administration",
      severity: isSuspend ? "Warning" : "Info",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: adminUid,
      targetName: targetData.name,
      targetRole: targetData.role,
      barangayId: targetData.barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: isSuspend ? "Admin privileges suspended due to audit review" : "Suspension lifted",
      metadata: { targetUid: adminUid }
    });

    await addDoc(collection(db, "notifications"), {
      barangayId: targetData.barangayId,
      targetUid: adminUid,
      title: isSuspend ? "Account Suspended" : "Account Reactivated",
      message: isSuspend
        ? "Your Barangay Admin privileges have been suspended. Please contact platform support."
        : "Your Barangay Admin privileges have been restored.",
      createdAt: new Date().toISOString(),
      read: false
    });

    await loadUsersList();

    await triggerLifecycleEmail("suspended", targetData.email, { name: targetData.name, isSuspend });
  };

  const assignSKOfficial = async (
    residentUid: string,
    position: "chairman" | "kagawad" | "secretary" | "treasurer",
    termStart: string,
    termEnd: string
  ) => {
    if (!profile || profile.role !== "barangay_admin") {
      throw new Error("Only Barangay Admin can assign SK positions");
    }

    const targetRef = doc(db, "users", residentUid);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error("Resident profile not found");
    const targetData = targetSnap.data() as UserProfile;

    if (targetData.barangayId !== profile.barangayId) {
      throw new Error("Cannot promote residents outside your assigned Barangay");
    }

    // Duplicate slot lock check
    const q = query(
      collection(db, "users"),
      where("barangayId", "==", profile.barangayId),
      where("role", "==", "sk_official"),
      where("position", "==", position),
      where("status", "==", "active")
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      throw new Error(`A resident is already assigned as active SK ${position} in this Barangay.`);
    }

    // 1. Create a historical record in terms subcollection
    const termsRef = collection(db, "users", residentUid, "terms");
    await addDoc(termsRef, {
      position,
      start: termStart,
      end: termEnd,
      assignedBy: profile.uid,
      reason: "Initial Appointment",
      timestamp: new Date().toISOString()
    });

    // 2. Perform updates
    const updates = {
      role: "sk_official" as const,
      position,
      status: "active" as const,
      termStart,
      termEnd,
      permissions: ["create_project", "upload_proof", "manage_milestones"]
    };
    await updateDoc(targetRef, updates);

    // 3. Log to audit logs
    await addDoc(collection(db, "audit_logs"), {
      action: "sk_official_assigned",
      category: "Governance",
      severity: "Info",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: residentUid,
      targetName: targetData.name,
      targetRole: "sk_official",
      barangayId: profile.barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Promoted to active SK ${position} from ${termStart} to ${termEnd}`,
      metadata: { position, termEnd }
    });

    // 4. Send notification
    await addDoc(collection(db, "notifications"), {
      barangayId: profile.barangayId,
      targetUid: residentUid,
      title: "Promoted to SK Official",
      message: `You have been promoted to SK ${position} by your Barangay Admin. Escrow proposal modules are now unlocked.`,
      createdAt: new Date().toISOString(),
      read: false
    });

    await loadUsersList();

    await triggerLifecycleEmail("sk_promoted", targetData.email, {
      name: targetData.name,
      position,
      termStart,
      termEnd,
      barangayName: profile.barangayName
    });
  };

  const revokeSKOfficial = async (residentUid: string) => {
    if (!profile || profile.role !== "barangay_admin") {
      throw new Error("Only Barangay Admin can revoke SK positions");
    }

    const targetRef = doc(db, "users", residentUid);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error("Resident profile not found");
    const targetData = targetSnap.data() as UserProfile;

    if (targetData.barangayId !== profile.barangayId) {
      throw new Error("Cannot revoke users outside your assigned Barangay");
    }

    const prevPosition = targetData.position;

    const termsRef = collection(db, "users", residentUid, "terms");
    await addDoc(termsRef, {
      position: "none",
      start: targetData.termStart || "",
      end: new Date().toISOString().split("T")[0],
      assignedBy: profile.uid,
      reason: "Revoked by Barangay Admin",
      timestamp: new Date().toISOString()
    });

    const updates = {
      role: "resident" as const,
      position: "none" as const,
      status: "inactive" as const,
      permissions: []
    };
    await updateDoc(targetRef, updates);

    await addDoc(collection(db, "audit_logs"), {
      action: "sk_official_revoked",
      category: "Governance",
      severity: "Warning",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: residentUid,
      targetName: targetData.name,
      targetRole: "resident",
      barangayId: profile.barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Revoked term as SK ${prevPosition}`,
      metadata: { prevPosition }
    });

    await addDoc(collection(db, "notifications"), {
      barangayId: profile.barangayId,
      targetUid: residentUid,
      title: "SK Role Revoked",
      message: `Your active term as SK ${prevPosition} has been revoked by the Barangay Admin.`,
      createdAt: new Date().toISOString(),
      read: false
    });

    await loadUsersList();

    await triggerLifecycleEmail("sk_expired", targetData.email, {
      name: targetData.name,
      prevPosition
    });
  };

  const refreshUsersList = async () => {
    if (profile && (profile.role === "system_admin" || profile.role === "barangay_admin")) {
      await loadUsersList();
    }
  };

  const refreshRoles = async () => {
    if (user) {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } catch (err) {
        console.error("Failed to refresh roles:", err);
      }
    }
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
    const bgyRef = doc(db, "barangays", barangayId);
    await setDoc(bgyRef, {
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
    }, { merge: true });

    await addDoc(collection(db, "audit_logs"), {
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
    const barangayRef = collection(db, "barangays");
    await addDoc(barangayRef, {
      name,
      municipality,
      province,
      status: "pending",
      active: false,
      createdAt: new Date().toISOString(),
      approvedAt: null,
      adminsCount: 0,
      residentsCount: 0,
      projectsCount: 0
    });
  };

  const approveBarangay = async (id: string) => {
    if (!profile || profile.role !== "system_admin") {
      throw new Error("Only System Admin can approve Barangays");
    }
    const docRef = doc(db, "barangays", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Barangay not found");
    const data = snap.data();

    await updateDoc(docRef, {
      status: "approved",
      active: true,
      approvedAt: new Date().toISOString(),
      approvedBy: profile.uid
    });

    await addDoc(collection(db, "audit_logs"), {
      action: "barangay_approved",
      category: "Administration",
      severity: "Info",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: id,
      targetName: data.name || data.barangayName,
      targetRole: "barangay",
      barangayId: id,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Approved Barangay ${data.name || data.barangayName}`,
      metadata: { id }
    });
  };

  const getApprovedBarangays = async (): Promise<Barangay[]> => {
    const q = query(
      collection(db, "barangays"),
      where("status", "==", "approved"),
      orderBy("name", "asc")
    );
    const querySnapshot = await getDocs(q);
    const list: Barangay[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Barangay);
    });
    return list;
  };

  const getAllBarangays = async (): Promise<Barangay[]> => {
    const q = query(
      collection(db, "barangays"),
      orderBy("name", "asc")
    );
    const querySnapshot = await getDocs(q);
    const list: Barangay[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Barangay);
    });
    return list;
  };

  const sendVerificationEmail = async () => {
    if (!user) throw new Error("User not authenticated");
    logger.auth("Sending Firebase verification email...", "AuthContext");
    try {
      await user.reload();
      await sendEmailVerification(user);
    } catch (err: any) {
      logger.error(`Firebase sendEmailVerification failed: ${err.message}`, "AuthContext");
      if (err.message?.includes("too-many-requests") || err.code === "auth/too-many-requests" || err.message?.includes("TOO_MANY_ATTEMPTS")) {
        throw new Error("Too many verification attempts. Please check your inbox or wait a few minutes before requesting another link.");
      }
      throw new Error(`Activation service error: ${err.message || "Bad Request"}`);
    }

    if (profile) {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        verificationEmailSentAt: new Date().toISOString()
      });
    }
    await triggerLifecycleEmail("verify_email", user.email || "", {
      name: profile?.name || "Valued Resident"
    });
  };

  const checkEmailVerificationStatus = async () => {
    if (!user) return false;
    logger.auth("Checking email verification status...", "AuthContext");
    await user.reload();
    if (user.emailVerified) {
      const isFullyRegistered = profile && profile.firstName && profile.firstName.trim() !== "";
      const updates = {
        emailVerified: true,
        status: isFullyRegistered ? ("pending" as const) : ("onboarding" as const),
        activationStatus: isFullyRegistered ? ("active" as const) : ("pending_email_verification" as const),
        activatedAt: new Date().toISOString()
      };
      if (profile) {
        const docRef = doc(db, "users", user.uid);
        await updateDoc(docRef, updates);
        setProfile((prev) => prev ? { ...prev, ...updates } : null);
      } else {
        setProfile({
          uid: user.uid,
          email: user.email || "",
          status: "onboarding",
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
          verificationStatus: "pending"
        } as any);
      }
      logger.success(`User email verified successfully! status flag: ${updates.status}.`, "AuthContext");

      await triggerLifecycleEmail("activated", user.email || "", {
        name: profile?.firstName ? profile.firstName : "Valued Resident"
      });

      return true;
    }
    return false;
  };

  const deleteCurrentUserForResubmission = async () => {
    if (auth.currentUser) {
      logger.auth("Deleting failed user account for immediate resubmission...", "AuthContext");
      await auth.currentUser.delete();
      setUser(null);
      setProfile(null);
    }
  };

  const triggerLifecycleEmail = async (type: string, recipient: string, data: any) => {
    try {
      logger.info(`[Email Dispatch] Triggering email event "${type}" to ${recipient}`, "AuthContext");
      await addDoc(collection(db, "mail"), {
        to: [recipient],
        type: type,
        data: data,
        message: {
          subject: type.replace(/_/g, " ").toUpperCase()
        },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      logger.error(`[Email Dispatch] Failed to trigger email: ${err.message}`, "AuthContext");
    }
  };

  const acknowledgeExpiration = async () => {
    if (!user || !profile) throw new Error("User not authenticated");
    const docRef = doc(db, "users", user.uid);
    const updates = {
      status: "active" as const,
      role: "resident" as const,
      position: "none" as const,
      permissions: []
    };
    await updateDoc(docRef, updates);
    setProfile((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
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
