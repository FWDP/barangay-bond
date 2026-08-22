import { doc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import type { UserProfile } from "../types/domain.types";
import { dbGetDoc, dbSetDoc, dbUpdateDoc, dbDeleteDoc, dbOnSnapshot } from "./db.helper";

export const userRepository = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, "users", uid);
    const snap = await dbGetDoc(userRef);
    if (!snap.exists()) return null;
    return { ...snap.data(), uid: snap.id } as UserProfile;
  },

  async createUserProfile(uid: string, profile: UserProfile): Promise<void> {
    const userRef = doc(db, "users", uid);
    await dbSetDoc(userRef, profile);
  },

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const userRef = doc(db, "users", uid);
    await dbUpdateDoc(userRef, updates);
  },

  async deleteUserProfile(uid: string): Promise<void> {
    const userRef = doc(db, "users", uid);
    await dbDeleteDoc(userRef);
  },

  subscribeToUserProfile(
    uid: string,
    onNext: (profile: UserProfile | null) => void,
    onError?: (error: any) => void
  ): () => void {
    const userRef = doc(db, "users", uid);
    return dbOnSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          onNext(null);
        } else {
          onNext({ ...snap.data(), uid: snap.id } as UserProfile);
        }
      },
      onError
    );
  },

  async queryUsersByBarangay(barangayId: string): Promise<UserProfile[]> {
    const q = query(collection(db, "users"), where("barangayId", "==", barangayId));
    const snap = await getDocs(q);
    const users: UserProfile[] = [];
    snap.forEach((docSnap) => {
      users.push({ ...docSnap.data(), uid: docSnap.id } as UserProfile);
    });
    return users;
  },

  async queryUsersByRequestedBarangay(barangayId: string): Promise<UserProfile[]> {
    const q = query(collection(db, "users"), where("requestedBarangayId", "==", barangayId));
    const snap = await getDocs(q);
    const users: UserProfile[] = [];
    snap.forEach((docSnap) => {
      users.push({ ...docSnap.data(), uid: docSnap.id } as UserProfile);
    });
    return users;
  },

  async queryUsersByEmail(email: string): Promise<UserProfile[]> {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    const users: UserProfile[] = [];
    snap.forEach((docSnap) => {
      users.push({ ...docSnap.data(), uid: docSnap.id } as UserProfile);
    });
    return users;
  }
};
