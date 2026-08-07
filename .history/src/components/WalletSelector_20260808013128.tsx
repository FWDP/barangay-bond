import React from "react";
import { useWallet } from "../contexts/WalletContext";
import { useAuth } from "../contexts/AuthContext";
import { requestWalletLinkSignature } from "../wallet/wallet";
import { logger } from "../utils/logger";

interface WalletSelectorProps {
  balance: string;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ balance }) => {
  const { address, walletId, connected, error, connect, disconnect } =
    useWallet();
  const { user, profile, linkWallet, unlinkWallet } = useAuth();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  const profileWallet = profile?.walletAddress;
  const isMismatched = profileWallet && address && profileWallet.toLowerCase() !== address.toLowerCase();
  const isLinked = profileWallet && (!address || profileWallet.toLowerCase() === address.toLowerCase());

  const handleLink = async () => {
    if (!profile) return;
    setCheckingLink(true);
    try {
      let activeAddress = address;
      let activeWalletId = walletId;

      // 1. If not connected, connect first
      if (!connected || !activeAddress) {
        logger.debug(`[WalletSelector] Wallet not connected. Prompting connect modal...`, "WalletSelector");
        const result = await connect();
        activeAddress = result.address;
        activeWalletId = result.walletId;
        logger.success(`[WalletSelector] Connected to address: ${activeAddress}`, "WalletSelector");
      }

      // 2. Perform database uniqueness check
      logger.debug(`[WalletSelector] Running database uniqueness query for ${activeAddress}...`, "WalletSelector");
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const { db } = await import("../services/firebase");
      
      const q = query(
        collection(db, "users"),
        where("walletAddress", "==", activeAddress)
      );
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(docSnap => docSnap.id !== user?.uid);
      
      if (isDuplicate) {
        throw new Error("This wallet address is already linked to another account in the database.");
      }

      // 3. Request signature challenge
      logger.debug(`[WalletSelector] Prompting signature challenge for address ${activeAddress}...`, "WalletSelector");
      const signedXdr = await requestWalletLinkSignature(activeAddress, profile.uid);

      // 4. Link wallet
      logger.debug(`[WalletSelector] Dispatching linkWallet command to database...`, "WalletSelector");
      await linkWallet(activeAddress, activeWalletId || "freighter", signedXdr);
      alert("Wallet successfully verified and linked to your profile!");
    } catch (err: any) {
      logger.error(`[WalletSelector] Unified connection/linking failed: ${err.message}`, "WalletSelector");
      const message = (err?.message || "").toLowerCase();
      const recoveryMessage = message.includes("sign") || message.includes("network") || message.includes("freighter") || message.includes("testnet") || message.includes("not possible")
        ? "Freighter rejected the signing request. Please switch Freighter to Testnet, then reset the wallet session and try again."
        : (err?.message || "Failed to connect and link wallet.");
      disconnect();
      alert(recoveryMessage);
    } finally {
      setCheckingLink(false);
    }
  };

  const handleResetSession = async () => {
    try {
      setCheckingLink(true);
      disconnect();
      alert("Wallet session cleared. You can reconnect or switch wallets and try again.");
    } catch (err: any) {
      logger.error(`[WalletSelector] Failed to clear wallet session: ${err.message}`, "WalletSelector");
      alert("Could not clear the wallet session automatically.");
    } finally {
      setCheckingLink(false);
    }
  };

  const handleUnlink = async () => {
    if (window.confirm("Are you sure you want to unlink this Stellar wallet from your profile? This will revoke your verified voter status until a wallet is re-linked.")) {
      logger.debug(`[WalletSelector] Requesting unlink wallet for profile UID: ${profile?.uid}...`, "WalletSelector");
      try {
        await unlinkWallet();
        disconnect(); // Reset react Freighter/LOBSTR connection session state
        alert("Wallet successfully unlinked from your profile!");
      } catch (err: any) {
        logger.error(`[WalletSelector] Wallet unlinking failed: ${err.message}`, "WalletSelector");
        alert("Failed to unlink wallet: " + err.message);
      }
    }
  };

  const isPending = profile?.status !== "active";

  const [linkedToOtherProfile, setLinkedToOtherProfile] = React.useState<boolean>(false);
  const [checkingLink, setCheckingLink] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!address || !user) {
      setLinkedToOtherProfile(false);
      return;
    }

    const checkWalletOwnership = async () => {
      setCheckingLink(true);
      logger.debug(`[WalletSelector] Verifying uniqueness of wallet ${address}...`, "WalletSelector");
      try {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("../services/firebase");
        
        const q = query(
          collection(db, "users"),
          where("walletAddress", "==", address)
        );
        const snap = await getDocs(q);
        
        // Find if any OTHER user has linked this wallet
        const duplicate = snap.docs.some(docSnap => docSnap.id !== user.uid);
        setLinkedToOtherProfile(duplicate);
        
        if (duplicate) {
          logger.warn(`[WalletSelector] Wallet ${address} is already linked to another account in the database!`, "WalletSelector");
        } else {
          logger.debug(`[WalletSelector] Wallet ${address} is unique. No other profile has linked it.`, "WalletSelector");
        }
      } catch (err) {
        console.error("Error checking wallet uniqueness:", err);
      } finally {
        setCheckingLink(false);
      }
    };

    checkWalletOwnership();
  }, [address, profile]);

  return (
    <div className="wallet-selector-card">
      {!profileWallet ? (
        // Case A: No wallet linked to profile yet
        <div className="wallet-disconnected text-center">
          {connected && address ? (
            <div className="wallet-connected-info mb-3">
              <div className="wallet-badge-container mb-2">
                <span className="wallet-badge">
                  {walletId ? walletId.toUpperCase() : "CONNECTED"}
                </span>
                <span className="wallet-address" title={address}>
                  {truncateAddress(address)}
                </span>
                {linkedToOtherProfile && (
                  <span className="badge badge-danger" style={{ marginLeft: "0.5rem", background: "#ef4444", color: "#ffffff", padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
                    ⚠️ Linked to another profile
                  </span>
                )}
              </div>
              {linkedToOtherProfile ? (
                <button className="btn btn-outline-danger btn-sm" onClick={disconnect}>
                  Disconnect
                </button>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={handleLink} disabled={checkingLink}>
                    {checkingLink ? "Linking Wallet..." : "Link Wallet to Profile"}
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={handleResetSession} disabled={checkingLink}>
                    {checkingLink ? "Resetting..." : "Reset Session"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleLink}
                  disabled={checkingLink || isPending}
                >
                  {isPending ? "Wallet Locked" : checkingLink ? "Connecting & Linking..." : "Link Stellar Wallet"}
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleResetSession}
                  disabled={checkingLink || isPending}
                >
                  {checkingLink ? "Resetting..." : "Reset Session"}
                </button>
              </div>
              {error && <p className="wallet-error-msg mt-2">{error}</p>}
              <p className="wallet-tip mt-2">Supported wallets: Freighter, xBull, Albedo, Lobstr</p>
            </>
          )}
        </div>
      ) : (
        // Case B: Wallet already linked to profile
        <div className="wallet-connected-info">
          <div className="wallet-badge-container">
            <span className="wallet-badge">
              {walletId ? walletId.toUpperCase() : "CONNECTED"}
            </span>
            <span className="wallet-address" title={address || profileWallet}>
              {address ? truncateAddress(address) : truncateAddress(profileWallet)}
            </span>

            {isMismatched && (
              <span className="badge badge-danger" style={{ marginLeft: "0.5rem", background: "#f59e0b", color: "#ffffff", padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
                ⚠️ Wallet Mismatch
              </span>
            )}

            {isLinked && (
              <>
                <span className="badge badge-success" style={{ marginLeft: "0.5rem" }}>
                  Linked
                </span>
                <button
                  className="btn btn-outline-danger btn-sm"
                  style={{ marginLeft: "0.75rem", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}
                  onClick={handleUnlink}
                >
                  Unlink Wallet
                </button>
              </>
            )}
          </div>

          {isMismatched && (
            <div className="wallet-mismatch-warning" style={{ color: "#f59e0b", fontSize: "0.85rem", marginTop: "0.5rem", fontWeight: 500 }}>
              Connected wallet does not match profile. Please switch Freighter/LOBSTR account to:{" "}
              <strong style={{ wordBreak: "break-all" }}>{truncateAddress(profileWallet)}</strong>
            </div>
          )}

          {!isMismatched && (
            <div className="wallet-balance-container">
              <span className="balance-label">Balance:</span>
              <span className="balance-value">{balance} XLM</span>
            </div>
          )}

          <button className="btn btn-outline-danger btn-sm" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};
