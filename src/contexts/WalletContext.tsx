import React, { createContext, useContext, useState, useEffect } from "react";
import { connectWallet, disconnectWallet as kitDisconnect } from "../wallet/wallet";

interface WalletContextType {
  address: string | null;
  walletId: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load linked wallet connection from session if active
  useEffect(() => {
    const savedAddress = sessionStorage.getItem("wallet_address");
    const savedWalletId = sessionStorage.getItem("wallet_id");
    if (savedAddress && savedWalletId) {
      setAddress(savedAddress);
      setWalletId(savedWalletId);
    }
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await connectWallet();
      setAddress(result.address);
      setWalletId(result.walletId);
      sessionStorage.setItem("wallet_address", result.address);
      sessionStorage.setItem("wallet_id", result.walletId);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
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
    sessionStorage.removeItem("wallet_address");
    sessionStorage.removeItem("wallet_id");
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
