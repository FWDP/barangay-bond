import React from "react";
import { useWallet } from "../contexts/WalletContext";

interface WalletSelectorProps {
  balance: string;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ balance }) => {
  const { address, walletId, connected, connecting, error, connect, disconnect } =
    useWallet();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
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
