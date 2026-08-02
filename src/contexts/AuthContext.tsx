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
  requestedRole: "sk" | "youth";
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
    desiredRole: "sk" | "youth"
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

  // Automatically register a pre-configured admin for testing
  const checkAdminSetup = async (uid: string, email: string) => {
    // If the email is the pre-configured admin, make sure they have a Firestore role = admin
    if (email === "admin@barangay.gov") {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        const adminProfile: UserProfile = {
          uid,
          email,
          name: "Barangay Admin",
          birthdate: "1980-01-01",
          barangay: "Central Barangay",
          role: "admin",
          requestedRole: "youth",
          walletAddress: "GDV44D7S6FDUT35QUOVE7Q3BNY4TNFCUZQX7BN66OLLSZDZGT47GDGN7",
          verified: true,
          verificationStatus: "approved",
          createdAt: new Date().toISOString(),
        };
        await setDoc(docRef, adminProfile);
        return adminProfile;
      }
    }
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          let docSnap = await getDoc(docRef);
          
          let userProfile = docSnap.exists()
            ? (docSnap.data() as UserProfile)
            : null;

          if (!userProfile) {
            // Check if this is the default admin logging in for the first time
            const createdAdmin = await checkAdminSetup(
              currentUser.uid,
              currentUser.email || ""
            );
            if (createdAdmin) {
              userProfile = createdAdmin;
            }
          }

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
    desiredRole: "sk" | "youth"
  ) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      
      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email,
        name,
        birthdate,
        barangay,
        role: "viewer", // Starts as viewer until verified by Admin
        requestedRole: desiredRole,
        walletAddress: null,
        verified: false,
        verificationStatus: "pending",
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
      
      // Look up default admin setup
      await checkAdminSetup(userCredential.user.uid, email);

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
