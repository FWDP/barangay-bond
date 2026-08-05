import React from "react";
import { useWallet } from "../contexts/WalletContext";
import { useAuth } from "../contexts/AuthContext";

interface WalletSelectorProps {
  balance: string;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ balance }) => {
  const { address, walletId, connected, connecting, error, connect, disconnect } =
    useWallet();
  const { profile, linkWallet } = useAuth();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  const isLinked = profile?.walletAddress && address && profile.walletAddress.toLowerCase() === address.toLowerCase();

  const handleLink = async () => {
    if (address) {
      try {
        await linkWallet(address, walletId || "freighter");
      } catch (err: any) {
        alert("Failed to link wallet: " + err.message);
      }
    }
  };

  return (
    <div className="wallet-selector-card">
      {!connected ? (
        <div className="wallet-disconnected">
          <button
            className="btn btn-primary"
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? "Connecting Wallet..." : "Connect Stellar Wallet"}
          </button>
          {error && <p className="wallet-error-msg">{error}</p>}
          <p className="wallet-tip">Supported wallets: Freighter, xBull, Albedo, Lobstr</p>
        </div>
      ) : (
        <div className="wallet-connected-info">
          <div className="wallet-badge-container">
            <span className="wallet-badge">
              {walletId ? walletId.toUpperCase() : "CONNECTED"}
            </span>
            <span className="wallet-address" title={address || ""}>
              {address ? truncateAddress(address) : ""}
            </span>
            
            {address && profile && !isLinked && (
              <button className="btn btn-primary btn-sm btn-link-wallet" onClick={handleLink}>
                Link Wallet to Profile
              </button>
            )}
            {isLinked && (
              <span className="badge badge-success" style={{ marginLeft: "0.5rem" }}>
                Linked
              </span>
            )}
          </div>
          <div className="wallet-balance-container">
            <span className="balance-label">Balance:</span>
            <span className="balance-value">{balance} XLM</span>
          </div>
          <button className="btn btn-outline-danger btn-sm" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};
