import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { connectWallet, disconnectWallet as kitDisconnect } from "../wallet/wallet";
import type { ConnectionResult } from "../wallet/wallet";
import { useAuth } from "./AuthContext";

interface WalletContextType {
  address: string | null;
  walletId: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<ConnectionResult>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Helper to purge all wallet-related storage items across current browser domain
export const purgeAllWalletStorage = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("wallet_") || key.startsWith("bb_wallet_"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.error("Failed to purge wallet storage:", e);
  }
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile, user } = useAuth();

  const currentUid = user?.uid || profile?.uid || null;

  // Strict user-scoped storage key generators
  const getScopedAddressKey = (uid: string) => `bb_wallet_address_${uid}`;
  const getScopedWalletIdKey = (uid: string) => `bb_wallet_id_${uid}`;

  // Complete wallet disconnect and state reset
  const disconnect = useCallback(() => {
    try {
      kitDisconnect();
    } catch (e) {
      // Ignore kit disconnect errors
    }
    setAddress(null);
    setWalletId(null);
    if (currentUid) {
      localStorage.removeItem(getScopedAddressKey(currentUid));
      localStorage.removeItem(getScopedWalletIdKey(currentUid));
    } else {
      purgeAllWalletStorage();
    }
  }, [currentUid]);

  // Auth switch & User-scoping enforcement Effect
  useEffect(() => {
    // 1. If unauthenticated or no active user UID, force complete blank state & disconnect
    if (!currentUid) {
      disconnect();
      purgeAllWalletStorage();
      return;
    }

    // 2. If user has a linked wallet in their Firestore profile
    if (profile?.walletAddress) {
      setAddress(profile.walletAddress);
      setWalletId(profile.walletProvider || "freighter");
      localStorage.setItem(getScopedAddressKey(currentUid), profile.walletAddress);
      localStorage.setItem(getScopedWalletIdKey(currentUid), profile.walletProvider || "freighter");
      return;
    }

    // 3. Check user-scoped cache for this specific UID
    const cachedAddress = localStorage.getItem(getScopedAddressKey(currentUid));
    const cachedWalletId = localStorage.getItem(getScopedWalletIdKey(currentUid));

    if (cachedAddress && cachedWalletId) {
      setAddress(cachedAddress);
      setWalletId(cachedWalletId);
    } else {
      // 4. Enforce strict blank wallet state for new / unlinked user session
      setAddress(null);
      setWalletId(null);
    }
  }, [currentUid, profile?.walletAddress, profile?.walletProvider, disconnect]);

  const connect = async (): Promise<ConnectionResult> => {
    setConnecting(true);
    setError(null);
    try {
      // Always disconnect any existing session before initiating new connection
      disconnect();
      const result = await connectWallet();
      setAddress(result.address);
      setWalletId(result.walletId);

      if (currentUid) {
        localStorage.setItem(getScopedAddressKey(currentUid), result.address);
        localStorage.setItem(getScopedWalletIdKey(currentUid), result.walletId);
      }
      return result;
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      const errMsg = err.message && err.message.includes("Freighter")
        ? "Freighter wallet is not installed."
        : err.message || "Failed to connect to wallet.";
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        walletId,
        connected: !!address,
        connecting,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
