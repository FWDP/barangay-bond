import React, { createContext, useContext, useState, useEffect } from "react";
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

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile, user } = useAuth();

  const clearWalletStorage = () => {
    localStorage.removeItem("wallet_address");
    localStorage.removeItem("wallet_id");
    localStorage.removeItem("bb_wallet_owner_uid");
    localStorage.removeItem("bb_wallet_owner_address");
    localStorage.removeItem("bb_wallet_owner_provider");
    setAddress(null);
    setWalletId(null);
  };

  // Load linked wallet connection from session if active
  useEffect(() => {
    const savedAddress = localStorage.getItem("wallet_address");
    const savedWalletId = localStorage.getItem("wallet_id");
    const savedOwnerUid = localStorage.getItem("bb_wallet_owner_uid");
    const savedOwnerAddress = localStorage.getItem("bb_wallet_owner_address");

    if (!savedAddress || !savedWalletId) {
      setAddress(null);
      setWalletId(null);
      return;
    }

    const walletBoundToAccount = savedOwnerUid && savedOwnerAddress && savedOwnerAddress === savedAddress;

    if (profile && walletBoundToAccount) {
      if (savedOwnerUid !== profile.uid) {
        clearWalletStorage();
        return;
      }
      if (profile.walletAddress && profile.walletAddress !== savedAddress) {
        clearWalletStorage();
        return;
      }
      if (!profile.walletAddress && savedOwnerAddress === savedAddress) {
        clearWalletStorage();
        return;
      }
      setAddress(savedAddress);
      setWalletId(savedWalletId);
    } else if (profile && profile.walletAddress) {
      // A current profile exists with a server truth, so the browser-local wallet must line up exactly.
      if (profile.walletAddress !== savedAddress) {
        clearWalletStorage();
      } else {
        setAddress(savedAddress);
        setWalletId(savedWalletId);
      }
    } else if (user && savedOwnerUid && savedOwnerUid !== user.uid) {
      clearWalletStorage();
    } else {
      setAddress(savedAddress);
      setWalletId(savedWalletId);
    }

    // Sync across tabs/windows
    const onStorage = (e: StorageEvent) => {
      if (e.key === "wallet_address") {
        setAddress(e.newValue);
      }
      if (e.key === "wallet_id") {
        setWalletId(e.newValue);
      }
      if (e.key === null && !localStorage.getItem("wallet_address")) {
        // clear
        setAddress(null);
        setWalletId(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [profile, user]);

  const connect = async (): Promise<ConnectionResult> => {
    setConnecting(true);
    setError(null);
    try {
      const result = await connectWallet();
      setAddress(result.address);
      setWalletId(result.walletId);
      localStorage.setItem("wallet_address", result.address);
      localStorage.setItem("wallet_id", result.walletId);
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

  const disconnect = () => {
    kitDisconnect();
    setAddress(null);
    setWalletId(null);
    localStorage.removeItem("wallet_address");
    localStorage.removeItem("wallet_id");
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
