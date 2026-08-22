import { collection } from "firebase/firestore";
import { db } from "../services/firebase";
import { dbAddDoc } from "./db.helper";

export interface MailEntry {
  to: string[];
  type: string;
  data: any;
  message: {
    subject: string;
  };
  timestamp: string;
}

export const mailRepository = {
  async triggerMail(entry: MailEntry): Promise<void> {
    const mailColl = collection(db, "mail");
    await dbAddDoc(mailColl, entry);
  }
};
