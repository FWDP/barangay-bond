import { doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

export interface WalletLinkDocument {
  walletAddress: string;
  walletProvider?: string;
  linkedAt: string;
  status: "active";
  signatureProof?: string | null;
}

export const walletRepository = {
  /**
   * Save or update the linked wallet for a specific user UID.
   * Document ID is exact auth UID: wallet_links/{uid}.
   * Uses setDoc with merge: true.
   */
  async linkWallet(
    uid: string,
    walletAddress: string,
    walletProvider: string = "freighter",
    signatureProof?: string | null
  ): Promise<void> {
    if (!uid) {
      throw new Error("Authenticated UID is required to save wallet link.");
    }

    const linkRef = doc(db, "wallet_links", uid);
    const payload: WalletLinkDocument = {
      walletAddress,
      walletProvider,
      linkedAt: new Date().toISOString(),
      status: "active",
      signatureProof: signatureProof || null,
    };

    await setDoc(linkRef, payload, { merge: true });
  },

  /**
   * Remove the linked wallet document for a user.
   */
  async unlinkWallet(uid: string): Promise<void> {
    if (!uid) return;
    const linkRef = doc(db, "wallet_links", uid);
    await deleteDoc(linkRef);
  },

  /**
   * Real-time listener for wallet_links/{uid} document.
   */
  subscribeToWalletLink(
    uid: string,
    onUpdate: (data: WalletLinkDocument | null) => void,
    onError?: (err: Error) => void
  ): () => void {
    if (!uid) {
      onUpdate(null);
      return () => {};
    }

    const linkRef = doc(db, "wallet_links", uid);
    return onSnapshot(
      linkRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as WalletLinkDocument);
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        console.error(`[walletRepository] onSnapshot error for wallet_links/${uid}:`, err);
        if (onError) onError(err);
      }
    );
  }
};
