import {
  setDoc as rawSetDoc,
  getDoc as rawGetDoc,
  updateDoc as rawUpdateDoc,
  addDoc as rawAddDoc,
  deleteDoc as rawDeleteDoc,
  onSnapshot as rawOnSnapshot,
} from "firebase/firestore";
import { logger } from "../utils/logger";

export const dbGetDoc = async (ref: any): Promise<any> => {
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

export const dbSetDoc = async (ref: any, data: any, options?: any) => {
  const startTime = Date.now();
  logger.database(`Firestore Write (setDoc) started: ${ref.path}`, "Firestore");
  try {
    if (options) {
      await rawSetDoc(ref, data, options);
    } else if (ref?.path?.startsWith("duplicate_reports/")) {
      await rawSetDoc(ref, data);
    } else {
      try {
        const existing = await rawGetDoc(ref);
        if (existing && existing.exists()) {
          await rawSetDoc(ref, data, { merge: true });
        } else {
          await rawSetDoc(ref, data);
        }
      } catch (innerReadErr) {
        await rawSetDoc(ref, data);
      }
    }
    logger.success(`Firestore Write (setDoc) finished: ${ref.path}`, "Firestore", {
      durationMs: Date.now() - startTime
    });
  } catch (err: any) {
    logger.error(`Firestore Write (setDoc) failed: ${ref.path}. Error: ${err.message}`, "Firestore", {
      metadata: { error: err.toString(), payload: data }
    });
    throw err;
  }
};

export const dbUpdateDoc = async (ref: any, data: any) => {
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
      metadata: { error: err.toString(), payload: data }
    });
    throw err;
  }
};

export const dbAddDoc = async (collRef: any, data: any) => {
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
      metadata: { error: err.toString(), payload: data }
    });
    throw err;
  }
};

export const dbDeleteDoc = async (ref: any) => {
  const startTime = Date.now();
  logger.database(`Firestore Delete (deleteDoc) started: ${ref.path}`, "Firestore");
  try {
    await rawDeleteDoc(ref);
    logger.success(`Firestore Delete (deleteDoc) finished: ${ref.path}`, "Firestore", {
      durationMs: Date.now() - startTime
    });
  } catch (err: any) {
    logger.error(`Firestore Delete (deleteDoc) failed: ${ref.path}. Error: ${err.message}`, "Firestore", {
      metadata: { error: err.toString() }
    });
    throw err;
  }
};

export const dbOnSnapshot = (
  ref: any,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) => {
  logger.database(`Firestore onSnapshot subscription started: ${ref.path}`, "Firestore");
  return rawOnSnapshot(ref, onNext, onError);
};
