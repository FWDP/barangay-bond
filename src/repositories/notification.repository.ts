import { collection } from "firebase/firestore";
import { db } from "../services/firebase";
import { dbAddDoc } from "./db.helper";

export interface NotificationEntry {
  barangayId: string;
  targetUid: string;
  title: string;
  message: string;
  createdAt: string;
  timestamp?: string;
  read: boolean;
}

export const notificationRepository = {
  async createNotification(entry: NotificationEntry): Promise<void> {
    const notificationsColl = collection(db, "notifications");
    const payload = {
      ...entry,
      timestamp: entry.timestamp || entry.createdAt || new Date().toISOString()
    };
    await dbAddDoc(notificationsColl, payload);
  }
};
