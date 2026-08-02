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
} from "firebase/firestore";
import { auth, db } from "../services/firebase";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  birthdate: string;
  barangay: string;
  role: "admin" | "sk" | "youth" | "viewer";
  requestedRole: "sk" | "youth" | "admin" | "viewer";
  walletAddress: string | null;
  verified: boolean;
  verificationStatus: "pending" | "approved" | "rejected";
  createdAt: string;
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
    barangay: string,
    desiredRole: "sk" | "youth" | "admin"
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkWallet: (walletAddress: string) => Promise<void>;
  verifyUserInDb: (
    targetUid: string,
    role: "sk" | "youth",
    isVerify: boolean
  ) => Promise<void>;
  refreshUsersList: () => Promise<void>;
  refreshRoles: () => Promise<void>;
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
          
          const userProfile = docSnap.exists()
            ? (docSnap.data() as UserProfile)
            : null;

          setProfile(userProfile);
          
          // If admin, load the users list
          if (userProfile && userProfile.role === "admin") {
            await loadUsersList();
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
    barangay: string,
    desiredRole: "sk" | "youth" | "admin"
  ) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Determine initial roles based on desired role and age check
      let initialRole: "admin" | "sk" | "youth" | "viewer" = "viewer";
      let initialRequestedRole: "sk" | "youth" | "admin" | "viewer" = desiredRole;
      let initialVerified = false;
      let initialStatus: "pending" | "approved" | "rejected" = "pending";

      if (desiredRole === "admin") {
        initialRole = "admin";
        initialRequestedRole = "admin";
        initialVerified = true;
        initialStatus = "approved";
      } else {
        // Calculate age
        const birthYear = new Date(birthdate).getFullYear();
        const currentYear = new Date().getFullYear();
        const age = currentYear - birthYear;
        
        if (age < 15 || age > 30) {
          // Overaged or underaged viewer
          initialRole = "viewer";
          initialRequestedRole = "viewer";
          initialVerified = true; // Auto-approved as permanent viewer
          initialStatus = "approved";
        }
      }
      
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email,
        name,
        birthdate,
        barangay,
        role: initialRole,
        requestedRole: initialRequestedRole,
        walletAddress: null,
        verified: initialVerified,
        verificationStatus: initialStatus,
        createdAt: new Date().toISOString(),
      };

      // Save user profile to Firestore
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
        setProfile(loadedProfile);
        if (loadedProfile.role === "admin") {
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

  const verifyUserInDb = async (
    targetUid: string,
    role: "sk" | "youth",
    isVerify: boolean
  ) => {
    if (!profile || profile.role !== "admin") {
      throw new Error("Only Barangay Admin can verify users");
    }

    const docRef = doc(db, "users", targetUid);
    const updates = {
      verified: isVerify,
      verificationStatus: isVerify ? "approved" : "rejected",
      role: isVerify ? role : "viewer",
    };
    
    await updateDoc(docRef, updates);
    await loadUsersList(); // Reload table
  };

  const refreshUsersList = async () => {
    if (profile && profile.role === "admin") {
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
