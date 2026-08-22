import { collection } from "firebase/firestore";
import { db } from "../services/firebase";
import { dbAddDoc } from "./db.helper";

export interface AuditLogEntry {
  action: string;
  category: string;
  severity: "Info" | "Warning" | "Error" | string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  targetUid: string;
  targetName: string;
  targetRole: string;
  barangayId: string;
  device: string;
  timestamp: string;
  notes: string;
  metadata?: any;
}

export const auditRepository = {
  async writeAuditLog(entry: AuditLogEntry): Promise<void> {
    const auditLogsColl = collection(db, "audit_logs");
    await dbAddDoc(auditLogsColl, entry);
  }
};
