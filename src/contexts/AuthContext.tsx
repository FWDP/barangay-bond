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
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  increment,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  birthdate: string;
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
  verified: boolean;
  verificationStatus: "pending" | "approved" | "rejected";
  createdAt: string;
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
  approvedBy?: string;
  approvedAt?: string;
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
    name: string,
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
    idPhotoUrl: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkWallet: (walletAddress: string) => Promise<void>;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
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
                  status: "expired" as const,
                  permissions: []
                };
                await updateDoc(docRef, expiredUpdates);
                
                // Write Audit Log
                await addDoc(collection(db, "audit_logs"), {
                  action: "sk_expired",
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

            setProfile(userProfile);
            await saveSessionInfo(currentUser.uid);

            if (userProfile.role === "system_admin" || userProfile.role === "barangay_admin") {
              await loadUsersList();
            }
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

  const loadUsersList = async () => {
    try {
      const q = query(collection(db, "users"));
      const querySnapshot = await getDocs(q);
      const list: UserProfile[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data() as UserProfile);
      });
      setDbUsers(list);
    } catch (err) {
      console.error("Failed to load users from Firestore:", err);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
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
    idPhotoUrl: string
  ) => {
    setLoading(true);
    try {
      // Only residents need an approved barangay — barangay_admin will be assigned one later by System Admin
      if (desiredRole === "resident") {
        const docRef = doc(db, "barangays", barangayId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || docSnap.data().status !== "approved") {
          throw new Error("Selected barangay is no longer active or approved.");
        }
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      let initialRole: "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer" = desiredRole;
      let initialStatus: "active" | "inactive" | "suspended" | "expired" | "pending" = "pending";
      let initialVerified = false;
      let initialVerStatus: "pending" | "approved" | "rejected" = "pending";
      let initialPermissions: string[] = [];

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
        birthdate,
        barangayId,
        barangayName,
        barangayMunicipality,
        barangayProvince,
        role: initialRole,
        requestedRole: desiredRole,
        status: initialStatus,
        position: "none",
        permissions: initialPermissions,
        walletAddress: null,
        verified: initialVerified,
        verificationStatus: initialVerStatus,
        createdAt: new Date().toISOString(),
        mobileNumber,
        address,
        idType,
        idNumber,
        schoolName,
        idPhotoUrl,
        verificationNotes: "",
        verifiedBy: "",
        verifiedAt: "",
      };

      await setDoc(doc(db, "users", userCredential.user.uid), newProfile);
      setProfile(newProfile);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
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
          await firebaseSignOut(auth);
          throw new Error("Your account has been suspended by LGU administrators.");
        }
        
        setProfile(loadedProfile);
        if (loadedProfile.role === "system_admin" || loadedProfile.role === "barangay_admin") {
          await loadUsersList();
        }
      }
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    setLoading(true);
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setDbUsers([]);
    setLoading(false);
  };

  const linkWallet = async (walletAddress: string) => {
    if (!user || !profile) throw new Error("User not authenticated");
    
    const docRef = doc(db, "users", user.uid);
    await updateDoc(docRef, { walletAddress });
    
    setProfile((prev) => {
      if (!prev) return null;
      return { ...prev, walletAddress };
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
