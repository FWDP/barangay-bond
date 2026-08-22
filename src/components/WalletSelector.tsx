import React from "react";
import { useWallet } from "../contexts/WalletContext";
import { useAuth } from "../contexts/AuthContext";
import { requestWalletLinkSignature } from "../wallet/wallet";
import { logger } from "../utils/logger";
import { Wallet, Unlink } from "lucide-react";

interface WalletSelectorProps {
  balance: string;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ balance }) => {
  const { address, walletId, connected, connect, disconnect } =
    useWallet();
  const { user, profile, linkWallet, unlinkWallet } = useAuth();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  const profileWallet = profile?.walletAddress;
  const isMismatched = profileWallet && address && profileWallet.toLowerCase() !== address.toLowerCase();
  const isLinked = profileWallet && (!address || profileWallet.toLowerCase() === address.toLowerCase());

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

        const duplicate = snap.docs.some(docSnap => docSnap.id !== user.uid);
        setLinkedToOtherProfile(duplicate);

        if (duplicate) {
          logger.warn(`[WalletSelector] Wallet ${address} is already linked to another account!`, "WalletSelector");
        }
      } catch (err) {
        console.error("Error checking wallet uniqueness:", err);
      } finally {
        setCheckingLink(false);
      }
    };

    checkWalletOwnership();
  }, [address, profile, user]);

  const handleLink = async () => {
    if (!profile) return;
    setCheckingLink(true);
    try {
      disconnect();
      logger.debug(`[WalletSelector] Prompting connect modal for fresh wallet account selection...`, "WalletSelector");
      const result = await connect();
      let activeAddress = result.address;
      let activeWalletId = result.walletId;
      logger.success(`[WalletSelector] Connected to address: ${activeAddress}`, "WalletSelector");

      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const { db } = await import("../services/firebase");

      const q = query(
        collection(db, "users"),
        where("walletAddress", "==", activeAddress)
      );
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(docSnap => docSnap.id !== user?.uid);

      if (isDuplicate) {
        const shortAddr = `${activeAddress.slice(0, 6)}...${activeAddress.slice(-6)}`;
        throw new Error(`This wallet address (${shortAddr}) is already bound to another registered account in the system.`);
      }

      logger.debug(`[WalletSelector] Prompting signature challenge for address ${activeAddress}...`, "WalletSelector");
      const signedXdr = await requestWalletLinkSignature(activeAddress, profile.uid);

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

  const handleUnlink = async () => {
    if (window.confirm("Are you sure you want to unlink this Stellar wallet from your profile? This will lock voting until a wallet is re-linked.")) {
      logger.debug(`[WalletSelector] Requesting unlink wallet for profile UID: ${profile?.uid}...`, "WalletSelector");
      try {
        await unlinkWallet();
        disconnect();
        alert("Wallet successfully unlinked from your profile!");
      } catch (err: any) {
        logger.error(`[WalletSelector] Wallet unlinking failed: ${err.message}`, "WalletSelector");
        alert("Failed to unlink wallet: " + err.message);
      }
    }
  };

  const isPending = profile?.status !== "active";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      {!profileWallet ? (
        // Case A: No wallet linked yet
        connected && address ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "var(--bg-elevated)", padding: "0.3rem 0.65rem", borderRadius: "10px", border: "1px solid var(--border-primary)" }}>
            <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>{walletId ? walletId.toUpperCase() : "CONNECTED"}</span>
            <code style={{ fontSize: "0.78rem", color: "var(--text-primary)", fontWeight: 700 }}>{truncateAddress(address)}</code>
            {linkedToOtherProfile ? (
              <button className="btn btn-outline-danger btn-sm" style={{ minHeight: "26px", padding: "0.15rem 0.45rem", fontSize: "0.72rem" }} onClick={disconnect}>
                Disconnect
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" style={{ minHeight: "26px", padding: "0.15rem 0.55rem", fontSize: "0.72rem" }} onClick={handleLink} disabled={checkingLink}>
                {checkingLink ? "Linking..." : "Link"}
              </button>
            )}
          </div>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleLink}
            disabled={checkingLink || isPending}
            style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem", minHeight: "36px", borderRadius: "10px" }}
          >
            <Wallet size={14} />
            {isPending ? "Locked" : checkingLink ? "Connecting..." : "Link Wallet"}
          </button>
        )
      ) : (
        // Case B: Wallet linked
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", background: "var(--bg-elevated)", padding: "0.35rem 0.75rem", borderRadius: "10px", border: "1px solid var(--border-primary)" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: isMismatched ? "#f59e0b" : "var(--accent-green)", display: "inline-block" }} />
          <code style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-primary)" }}>
            {truncateAddress(address || profileWallet)}
          </code>

          {isMismatched ? (
            <span className="badge badge-warning" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>
              Mismatch
            </span>
          ) : (
            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-green)" }}>
              {balance} XLM
            </span>
          )}

          {isLinked && (
            <button
              onClick={handleUnlink}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.1rem", display: "flex", alignItems: "center" }}
              title="Unlink Wallet"
            >
              <Unlink size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletSelector;
