import { useState, useEffect } from "react";
import { walletRepository, type WalletLinkDocument } from "../repositories/wallet.repository";

export function useWalletLink(uid?: string | null) {
  const [walletLink, setWalletLink] = useState<WalletLinkDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setWalletLink(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = walletRepository.subscribeToWalletLink(
      uid,
      (data) => {
        setWalletLink(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { walletLink, loading, error };
}
