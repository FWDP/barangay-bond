import React, { createContext, useContext, useState, useEffect } from "react";
import { connectWallet, disconnectWallet as kitDisconnect } from "../wallet/wallet";
import { isResidentVerified, isSKOfficial } from "../rpc/rpc";
import type { UserRoles } from "../types";

interface WalletContextType {
  address: string | null;
  walletId: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  roles: UserRoles;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshRoles: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<UserRoles>({
    isAdmin: false,
    isSKOfficial: false,
    isYouth: false,
  });

  // Automatically load connection from session storage if existed
  useEffect(() => {
    const savedAddress = sessionStorage.getItem("wallet_address");
    const savedWalletId = sessionStorage.getItem("wallet_id");
    if (savedAddress && savedWalletId) {
      setAddress(savedAddress);
      setWalletId(savedWalletId);
      loadRoles(savedAddress);
    }
  }, []);

  const loadRoles = async (addr: string) => {
    try {
      // Contract Admin is hardcoded or checked. Our initialized admin was GDV44D7S...
      const adminAddress = "GDV44D7S6FDUT35QUOVE7Q3BNY4TNFCUZQX7BN66OLLSZDZGT47GDGN7";
      
      const [isSk, isYouth] = await Promise.all([
        isSKOfficial(addr),
        isResidentVerified(addr),
      ]);

      setRoles({
        isAdmin: addr.toUpperCase() === adminAddress.toUpperCase(),
        isSKOfficial: isSk,
        isYouth: isYouth,
      });
    } catch (err) {
      console.error("Failed to load user roles from contract:", err);
    }
  };

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await connectWallet();
      setAddress(result.address);
      setWalletId(result.walletId);
      sessionStorage.setItem("wallet_address", result.address);
      sessionStorage.setItem("wallet_id", result.walletId);
      await loadRoles(result.address);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      // Friendly messages for Level 2 required errors
      if (err.message && err.message.includes("Freighter")) {
        setError("Freighter wallet is not installed.");
      } else {
        setError(err.message || "Failed to connect to wallet.");
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    kitDisconnect();
    setAddress(null);
    setWalletId(null);
    setRoles({ isAdmin: false, isSKOfficial: false, isYouth: false });
    sessionStorage.removeItem("wallet_address");
    sessionStorage.removeItem("wallet_id");
  };

  const refreshRoles = async () => {
    if (address) {
      await loadRoles(address);
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
        roles,
        connect,
        disconnect,
        refreshRoles,
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
