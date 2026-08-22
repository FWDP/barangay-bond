import { collection } from "firebase/firestore";
import { db } from "../services/firebase";
import { dbAddDoc } from "./db.helper";

export interface SessionEntry {
  uid: string;
  sessionId: string;
  browser: string;
  platform: string;
  deviceType: string;
  loginTime: string;
  lastSeen: string;
}

export const sessionRepository = {
  async createSession(entry: SessionEntry): Promise<void> {
    const sessionsColl = collection(db, "sessions");
    await dbAddDoc(sessionsColl, entry);
  }
};
