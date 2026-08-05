import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { GeminiIdentityProvider, checkDuplicates } from "../services/gemini";
import { logger } from "../utils/logger";
import { normalizeName, normalizeAddress, normalizeMobileNumber, normalizeEmail } from "../utils/normalization";

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
  status: "active" | "inactive" | "suspended" | "expired" | "pending";
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
  aiVerificationId?: string;
  duplicateRisk?: boolean;
  studentNumber?: string;
  decision?: string;
  scores?: any;
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
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  dbUsers: UserProfile[];
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
    desiredRole: "resident" | "barangay_admin" | "system_admin",
    mobileNumber: string,
    address: string,
    idType: string,
    idNumber: string,
    schoolName: string,
    idPhotoUrl: string,
    selfiePhotoUrl?: string,
    professionalInfo?: string,
    adminReason?: string,
    profilePhotoUrl?: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkWallet: (walletAddress: string, walletProvider: string) => Promise<void>;
  verifyUserInDb: (
    targetUid: string,
    role: "sk" | "youth",
    isVerify: boolean,
    notes: string
  ) => Promise<void>;
  refreshUsersList: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  
  proposeBarangay: (name: string, municipality: string, province: string) => Promise<void>;
  approveBarangay: (id: string) => Promise<void>;
  getApprovedBarangays: () => Promise<Barangay[]>;
  getAllBarangays: () => Promise<Barangay[]>;
  
  approveBarangayAdmin: (adminUid: string, barangayId: string, barangayName: string) => Promise<void>;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);
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

  const setDoc = async (ref: any, data: any) => {
    const startTime = Date.now();
    logger.database(`Firestore Write (setDoc) started: ${ref.path}`, "Firestore");
    try {
      await rawSetDoc(ref, data);
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
      throw err;
    }
  };
  useEffect(() => {
    logger.setUserContext(profile);
    if (profile) {
      logger.info(`Observability active user context set to: ${profile.email} (${profile.role})`, "AUTH");
    }
  }, [profile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (registeringEmailRef.current && currentUser.email && registeringEmailRef.current.toLowerCase() === currentUser.email.toLowerCase()) {
          logger.debug(`[AuthContext] onAuthStateChanged: Bypassing profile check for actively registering user ${currentUser.email}`, "AuthContext");
          return;
        }
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          let userProfile = docSnap.exists()
            ? (docSnap.data() as UserProfile)
            : null;

          if (userProfile) {
            // Check dynamic SK Official Term Expiration
            if (userProfile.role === "sk_official" && userProfile.termEnd) {
              const today = new Date().toISOString().split("T")[0];
              if (today > userProfile.termEnd) {
                // Demote SK status
                const expiredUpdates = {
                  role: "resident" as const,
                  position: "none" as const,
                  status: "active" as const,
                  permissions: []
                };
                await updateDoc(docRef, expiredUpdates);
                
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

            if (userProfile.status !== "active") {
              logger.warn(`Auth session active but status is ${userProfile.status.toUpperCase()} for: ${currentUser.email || currentUser.uid}. Auto-signing out.`, "AuthContext");
              await firebaseSignOut(auth);
              setUser(null);
              setProfile(null);
            } else {
              setProfile(userProfile);
              await saveSessionInfo(currentUser.uid);

              if (userProfile.role === "system_admin" || userProfile.role === "barangay_admin") {
                await loadUsersList();
              }
            }
          } else {
            logger.warn(`Auth session active but profile missing in Firestore for: ${currentUser.email || currentUser.uid}. Auto-signing out.`, "AuthContext");
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
        }
      } else {
        setProfile(null);
        setDbUsers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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

  const loadUsersList = async () => {
    if (!profile) return;
    try {
      const list: UserProfile[] = [];
      
      if (profile.role === "system_admin") {
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
      } else if (profile.role === "barangay_admin") {
        logger.database(`Barangay Admin: Querying resident_verification_queue for barangay ${profile.barangayId}`, "AuthContext");
        const q = query(
          collection(db, "resident_verification_queue"), 
          where("barangayId", "==", profile.barangayId)
        );
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          const qEntry = docSnap.data();
          const userRef = doc(db, "users", qEntry.uid);
          const uSnap = await getDoc(userRef);
          if (uSnap.exists()) {
            list.push(uSnap.data() as UserProfile);
          }
        }
        
        // Also fetch active officials / SK officials that are already approved
        const skQ = query(
          collection(db, "users"),
          where("barangayId", "==", profile.barangayId),
          where("role", "in", ["resident", "sk_official"]),
          where("verificationStatus", "==", "approved")
        );
        const skSnap = await getDocs(skQ);
        skSnap.forEach(docSnap => {
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
    desiredRole: "resident" | "barangay_admin" | "system_admin",
    mobileNumber: string,
    address: string,
    idType: string,
    idNumber: string,
    schoolName: string,
    idPhotoUrl: string,
    selfiePhotoUrl?: string,
    professionalInfo?: string,
    adminReason?: string,
    profilePhotoUrl?: string
  ) => {
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
        if (!docSnap.exists() || docSnap.data().status !== "approved") {
          logger.warn(`Layer 1 rule validation failed: Selected barangay ${barangayId} is inactive/unapproved.`, "AuthContext", { correlationId });
          throw new Error("Selected barangay is no longer active or approved.");
        }
      }

      logger.debug("Creating Firebase Auth credential...", "AuthContext", { correlationId });
      
      // Set email ref BEFORE calling the async authentication trigger to block race-condition logouts
      registeringEmailRef.current = email;

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const uid = userCredential.user.uid;

      // Store assets directly as compressed Base64 strings in Firestore metadata registry (free tier limits safeguard)
      logger.info(`Storing compressed registration images for ${uid} in Firestore uploaded_documents...`, "AuthContext", { correlationId });
      
      const storageIdUrl = idPhotoUrl;
      await setDoc(doc(db, "uploaded_documents", `${uid}_id`), {
        uid,
        documentType: idType,
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

      try {
        let initialRole: "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer" = desiredRole;
      let initialStatus: "active" | "inactive" | "suspended" | "expired" | "pending" = "pending";
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

      if (desiredRole === "system_admin") {
        initialRole = "system_admin";
        initialStatus = "active";
        initialVerified = true;
        initialVerStatus = "approved";
        initialPermissions = ["approve_barangay", "manage_admins", "verify_residents"];
      }

      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
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
        idPhotoUrl: storageIdUrl,
        selfiePhotoUrl: storageSelfieUrl,
        professionalInfo: professionalInfo || "N/A",
        adminReason: adminReason || "N/A",
        profilePhotoUrl: storageProfileUrl,
        photoURL: storageProfileUrl === "N/A" ? "" : storageProfileUrl,
        lastLogin: new Date().toISOString(),
        emailVerified: false,
        aiVerificationId: "",
        duplicateRisk: false,
        verificationNotes: "",
        verifiedBy: "",
        verifiedAt: "",
      };

      let dupResult = { maxScore: 0, matches: [] as any[] };

      // Perform AI logic if it is resident (age 15-30) OR if it is a pending Barangay Admin applicant
      if ((desiredRole === "resident" && age >= 15 && age <= 30) || desiredRole === "barangay_admin") {
        logger.debug("Layer 2: Initiating fuzzy database duplicates checks...", "AuthContext", { correlationId });
        try {
          dupResult = await checkDuplicates(name, birthdate, idNumber, address, mobileNumber);
          logger.info(`Layer 2 duplicate scan finished. Max similarity match: ${dupResult.maxScore}%`, "AuthContext", {
            correlationId,
            metadata: dupResult.matches
          });
        } catch (dupError: any) {
          logger.warn(`Guest duplicate check bypassed due to Firestore permissions constraint: ${dupError.message || dupError}. Scans will be run securely during Administrator review.`, "AuthContext", { correlationId });
        }

        const hasExactDuplicate = dupResult.matches.length > 0 && dupResult.matches.some((m: any) => m.similarity >= 95);

        if (hasExactDuplicate) {
          logger.warn(`Layer 2 duplicate check failed: Exact match exists. Coercing to auto_rejected.`, "AuthContext", { correlationId });
          newProfile.verificationStatus = "auto_rejected";
          newProfile.status = "inactive";
          newProfile.aiDecision = "auto_reject";
          newProfile.riskScore = 100;
          newProfile.duplicateScore = dupResult.maxScore;
          newProfile.autoRejectReason = "Exact duplicate identity or ID number found in database.";
        } else {
          logger.ai(`Layer 3: Sending document visual analysis to Gemini Vision API...`, "AuthContext", { correlationId });
          const geminiProvider = new GeminiIdentityProvider();
          try {
            const aiResult = await geminiProvider.analyzeIdentity({
              name,
              birthdate,
              address,
              barangayName: desiredRole === "barangay_admin" ? "Unassigned" : barangayName,
              municipality: desiredRole === "barangay_admin" ? "N/A" : barangayMunicipality,
              province: desiredRole === "barangay_admin" ? "N/A" : barangayProvince,
              idType,
              idNumber,
              schoolName: schoolName || undefined,
              imageDataUrl: idPhotoUrl
            });

            logger.success("Layer 3 Gemini Vision returned structured JSON extraction successfully", "AuthContext", {
              correlationId,
              metadata: aiResult
            });

            // Evaluate risk decisions
            const isAutoReject =
              aiResult.recommendation === "AUTO_REJECT" ||
              !aiResult.faceDetected ||
              aiResult.tamperingDetected ||
              aiResult.screenshotDetected ||
              aiResult.aiGeneratedDetected ||
              !aiResult.imageQuality.readable;

            if (isAutoReject) {
              logger.warn(`AI Analysis triggered AUTO_REJECT recommendation`, "AuthContext", { correlationId });
              newProfile.verificationStatus = "auto_rejected";
              newProfile.status = "inactive";
              newProfile.aiDecision = "auto_reject";
              newProfile.riskScore = aiResult.riskScore;
              newProfile.autoRejectReason = aiResult.reasons.join(", ") || "Failed document quality or authenticity check.";
            } else if (desiredRole === "barangay_admin") {
              // Stricter Threshold Matrix for Barangay Admins
              // Even if AI returns 100% confidence, status must remain "pending", requiring System Admin final confirmation.
              logger.info(`AI analysis evaluated for Barangay Admin. Queueing for System Admin review.`, "AuthContext", { correlationId });
              newProfile.verificationStatus = "pending";
              newProfile.status = "pending";
              newProfile.aiDecision = (aiResult.recommendation === "AUTO_ACCEPT" && aiResult.riskScore === 0 && aiResult.confidence >= 99)
                ? "auto_accept"
                : "manual_review";
              newProfile.riskScore = aiResult.riskScore;
            } else {
              // Resident Decision Matrix
              if (
                aiResult.recommendation === "AUTO_ACCEPT" &&
                aiResult.riskScore === 0 &&
                aiResult.confidence >= 99 &&
                dupResult.maxScore < 70
              ) {
                logger.success(`AI Analysis triggered AUTO_ACCEPT fast-track recommendation`, "AuthContext", { correlationId });
                newProfile.verificationStatus = "ai_verified";
                newProfile.aiDecision = "auto_accept";
                newProfile.riskScore = 0;
              } else {
                logger.info(`AI Analysis queued profile for MANUAL_REVIEW`, "AuthContext", { correlationId });
                newProfile.verificationStatus = "pending";
                newProfile.aiDecision = "manual_review";
                newProfile.riskScore = aiResult.riskScore;
              }
            }

            // Create ai_verifications record
            const verificationId = `${userCredential.user.uid}_${Date.now()}`;
            logger.database(`Writing ai_verifications/${verificationId} to Firestore`, "AuthContext", { correlationId });
            await setDoc(doc(db, "ai_verifications", verificationId), {
              userId: userCredential.user.uid,
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
              faceDetected: aiResult.faceDetected,
              tamperingDetected: aiResult.tamperingDetected,
              screenshotDetected: aiResult.screenshotDetected,
              aiGeneratedDetected: aiResult.aiGeneratedDetected,
              duplicateMatches: dupResult.matches,
              modelVersion: "gemini-2.5-flash"
            });

            // If borderline AI result (score 40-79), place in ai_review_queue
            if (aiResult.confidence >= 40 && aiResult.confidence <= 79) {
              logger.database(`Adding borderline score ${aiResult.confidence}% user ${userCredential.user.uid} to ai_review_queue`, "AuthContext", { correlationId });
              await setDoc(doc(db, "ai_review_queue", userCredential.user.uid), {
                userId: userCredential.user.uid,
                score: aiResult.confidence,
                reason: aiResult.reasons.join(", "),
                status: "pending"
              });
            }

            newProfile.latestVerificationId = verificationId;
            newProfile.duplicateScore = dupResult.maxScore;
            newProfile.requiresManualReview = (newProfile.verificationStatus === "pending");
            newProfile.imageQualitySummary = Object.entries(aiResult.imageQuality)
              .filter(([_, val]) => val)
              .map(([key, _]) => key)
              .join(", ") || "Good";
            newProfile.decision = aiResult.decision;
            newProfile.scores = aiResult.scores;

          } catch (geminiError: any) {
            logger.error(`Gemini verification error, falling back: ${geminiError.message}`, "AuthContext", { correlationId });
            newProfile.verificationStatus = "pending";
            newProfile.aiDecision = "manual_review";
            newProfile.riskScore = 50;
            newProfile.duplicateScore = dupResult.maxScore;
            newProfile.verificationNotes = "AI identity analysis was temporarily offline. Pending manual audit.";
            newProfile.requiresManualReview = true;
          }
        }
      }

      logger.database(`Writing users/${userCredential.user.uid} to Firestore`, "AuthContext", { correlationId });
      await setDoc(doc(db, "users", userCredential.user.uid), newProfile);

      // 1. Initial wallet link state document
      await setDoc(doc(db, "wallet_links", uid), {
        uid,
        wallet: "",
        verified: false,
        linkedAt: ""
      });

      // 2. Queue placement based on role
      if (desiredRole === "barangay_admin") {
        logger.database(`Adding ${uid} to barangay_admin_requests queue`, "AuthContext", { correlationId });
        await setDoc(doc(db, "barangay_admin_requests", uid), {
          uid,
          barangayId: "unassigned",
          status: "pending",
          submittedAt: new Date().toISOString(),
          approvedBy: null
        });
      } else if (desiredRole === "resident") {
        logger.database(`Adding ${uid} to resident_verification_queue`, "AuthContext", { correlationId });
        await setDoc(doc(db, "resident_verification_queue", uid), {
          uid,
          barangayId,
          status: "pending",
          submittedAt: new Date().toISOString(),
          aiRisk: newProfile.aiDecision || "pending",
          duplicate: newProfile.duplicateRisk || false
        });
      }

      // 3. Write duplicate reports if duplicates exist
      if (typeof dupResult !== "undefined" && dupResult.matches && dupResult.matches.length > 0) {
        newProfile.duplicateRisk = true;
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

      logger.info(`Registration finished. Signing out user to prevent dashboard entry until approved.`, "AuthContext", { correlationId });
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      
      logger.success(`Registration complete for ${email}. Status: ${newProfile.verificationStatus}`, "AuthContext", {
        correlationId,
        durationMs: Date.now() - startTime
      });
      } catch (innerErr) {
        if (auth.currentUser) {
          logger.warn(`Inner registration steps failed. Cleaning up auth session...`, "AuthContext", { correlationId });
          await firebaseSignOut(auth);
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
        
        if (loadedProfile.status === "pending") {
          logger.warn(`Login rejected: User ${email} is pending approval`, "AuthContext", { correlationId });
          await firebaseSignOut(auth);
          throw new Error("Your Barangay Bond registration is still under review. Your account cannot access the platform until approval.");
        }
        
        if (loadedProfile.status === "suspended") {
          logger.warn(`Login rejected: User ${email} is suspended`, "AuthContext", { correlationId });
          await firebaseSignOut(auth);
          throw new Error("Your account has been suspended by the platform administrator.");
        }

        if (loadedProfile.status === "inactive") {
          logger.warn(`Login rejected: User ${email} is inactive`, "AuthContext", { correlationId });
          await firebaseSignOut(auth);
          throw new Error("Your account is inactive. Please contact your Barangay Administrator.");
        }
        
        setProfile(loadedProfile);
        logger.success(`Login successful for ${email}`, "AuthContext", { 
          correlationId, 
          durationMs: Date.now() - startTime 
        });

        if (loadedProfile.role === "system_admin" || loadedProfile.role === "barangay_admin") {
          await loadUsersList();
        }
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

  const signOut = async () => {
    setLoading(true);
    const email = profile?.email || "Guest";
    logger.auth(`Signing out user: ${email}`, "AuthContext");
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setDbUsers([]);
    setLoading(false);
    logger.success(`Sign out complete for ${email}`, "AuthContext");
  };

  const linkWallet = async (walletAddress: string, walletProvider: string) => {
    if (!user || !profile) throw new Error("User not authenticated");
    
    if (profile.walletAddress) {
      throw new Error("A wallet is already linked to this profile. You cannot change your linked wallet.");
    }

    const docRef = doc(db, "users", user.uid);
    const updates = {
      walletAddress,
      walletProvider,
      walletVerified: true,
      walletLinkedAt: new Date().toISOString()
    };
    await updateDoc(docRef, updates);
    
    setProfile((prev) => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
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
    if (!profile || profile.role !== "barangay_admin") {
      throw new Error("Only Barangay Admin can verify users");
    }

    const targetRef = doc(db, "users", targetUid);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error("Resident not found");
    const targetData = targetSnap.data() as UserProfile;

    if (targetData.barangayId !== profile.barangayId) {
      throw new Error("Cannot verify resident outside your assigned Barangay");
    }

    const targetRoleName = role === "sk" ? "sk_official" : "resident";

    const updates = {
      verified: isVerify,
      verificationStatus: isVerify ? ("approved" as const) : ("rejected" as const),
      role: isVerify ? (targetRoleName as any) : ("resident" as any),
      status: isVerify ? ("active" as const) : ("inactive" as const),
      verificationNotes: notes,
      verifiedBy: profile.email || "admin",
      verifiedAt: new Date().toISOString(),
      currentlyReviewedBy: null,
      reviewStartedAt: null
    };
    await updateDoc(targetRef, updates);

    // Update queue request document
    const queueRef = doc(db, "resident_verification_queue", targetUid);
    await updateDoc(queueRef, {
      status: isVerify ? "approved" : "rejected"
    });

    if (isVerify) {
      const barangayRef = doc(db, "barangays", targetData.barangayId);
      await updateDoc(barangayRef, {
        residentsCount: increment(1)
      });
    }

    // Rich Category/Severity Audit Logs
    await addDoc(collection(db, "audit_logs"), {
      action: isVerify ? "resident_approved" : "resident_rejected",
      category: "Verification",
      severity: isVerify ? "Info" : "Warning",
      actorUid: profile.uid,
      actorName: profile.name,
      actorRole: profile.role,
      targetUid: targetUid,
      targetName: targetData.name,
      targetRole: targetRoleName,
      barangayId: profile.barangayId,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: isVerify ? `Residency verified. Remarks: ${notes}` : `Verification rejected. Reason: ${notes}`,
      metadata: { targetMobile: targetData.mobileNumber }
    });

    await addDoc(collection(db, "notifications"), {
      barangayId: profile.barangayId,
      targetUid: targetUid,
      title: isVerify ? "Account Verified" : "Verification Rejected",
      message: isVerify 
        ? "Your Barangay residency profile has been verified. You can now connect your wallet and audit local projects."
        : `Your verification request was rejected. Notes: ${notes}`,
      createdAt: new Date().toISOString(),
      read: false
    });

    await loadUsersList();
  };

  const approveBarangayAdmin = async (adminUid: string, barangayId: string, barangayName: string) => {
    if (!profile || profile.role !== "system_admin") {
      throw new Error("Only System Admin can approve Barangay Admins");
    }
    
    const targetRef = doc(db, "users", adminUid);
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error("Admin profile not found");
    const targetData = targetSnap.data() as UserProfile;
    
    const updates = {
      status: "active" as const,
      role: "barangay_admin" as const,
      barangayId,
      barangayName,
      verified: true,
      verificationStatus: "approved" as const,
      approvedBy: profile.uid,
      approvedAt: new Date().toISOString(),
      permissions: ["verify_residents", "assign_sk"]
    };
    await updateDoc(targetRef, updates);
    
    // Update queue request document
    const requestRef = doc(db, "barangay_admin_requests", adminUid);
    await updateDoc(requestRef, {
      status: "approved",
      approvedBy: profile.uid
    });
    
    const barangayRef = doc(db, "barangays", barangayId);
    await updateDoc(barangayRef, {
      adminsCount: increment(1)
    });

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

  const proposeBarangay = async (name: string, municipality: string, province: string) => {
    const barangayRef = collection(db, "barangays");
    await addDoc(barangayRef, {
      name,
      municipality,
      province,
      status: "pending",
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
      targetName: data.name,
      targetRole: "barangay",
      barangayId: id,
      device: navigator.userAgent.substring(0, 100),
      timestamp: new Date().toISOString(),
      notes: `Approved Barangay ${data.name} in ${data.municipality}, ${data.province}`,
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
        signUp,
        signIn,
        signOut,
        linkWallet,
        verifyUserInDb,
        refreshUsersList,
        refreshRoles,
        proposeBarangay,
        approveBarangay,
        getApprovedBarangays,
        getAllBarangays,
        approveBarangayAdmin,
        suspendBarangayAdmin,
        assignSKOfficial,
        revokeSKOfficial,
        lockProfileForReview,
        acknowledgeExpiration,
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
