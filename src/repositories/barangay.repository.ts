import { doc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import type { Barangay } from "../types/domain.types";
import { dbGetDoc, dbSetDoc, dbUpdateDoc, dbAddDoc } from "./db.helper";

export const barangayRepository = {
  async getBarangay(id: string): Promise<Barangay | null> {
    const bgyRef = doc(db, "barangays", id);
    const snap = await dbGetDoc(bgyRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Barangay;
  },

  async createBarangay(id: string, data: Barangay): Promise<void> {
    const bgyRef = doc(db, "barangays", id);
    await dbSetDoc(bgyRef, data);
  },

  async createBarangayMerge(id: string, data: any): Promise<void> {
    const bgyRef = doc(db, "barangays", id);
    await dbSetDoc(bgyRef, data, { merge: true });
  },

  async updateBarangay(id: string, updates: any): Promise<void> {
    const bgyRef = doc(db, "barangays", id);
    await dbUpdateDoc(bgyRef, updates);
  },

  async proposeBarangay(name: string, municipality: string, province: string): Promise<void> {
    const barangaysColl = collection(db, "barangays");
    await dbAddDoc(barangaysColl, {
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
  },

  async getApprovedBarangays(): Promise<Barangay[]> {
    const q = query(
      collection(db, "barangays"),
      where("status", "==", "approved"),
      orderBy("name", "asc")
    );
    const snap = await getDocs(q);
    const list: Barangay[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Barangay);
    });
    return list;
  },

  async getAllBarangays(): Promise<Barangay[]> {
    const q = query(
      collection(db, "barangays"),
      orderBy("name", "asc")
    );
    const snap = await getDocs(q);
    const list: Barangay[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Barangay);
    });
    return list;
  }
};
