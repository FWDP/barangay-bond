import { StellarWalletsKit, Networks } from "@creit-tech/stellar-wallets-kit";
import { FreighterModule } from "@creit-tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit-tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule } from "@creit-tech/stellar-wallets-kit/modules/albedo";
import { LobstrModule } from "@creit-tech/stellar-wallets-kit/modules/lobstr";
import { STELLAR_CONFIG } from "../configuration/config";
import { TransactionBuilder, Account, TimeoutInfinite, Transaction, Keypair, Operation } from "@stellar/stellar-sdk";
import { logger } from "../utils/logger";

const network =
  STELLAR_CONFIG.network === "testnet"
    ? Networks.TESTNET
    : Networks.PUBLIC;

// Initialize the static class once with support for desktop extensions and mobile web/app linking
StellarWalletsKit.init({
  network,
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new LobstrModule(),
    new xBullModule(),
  ],
});

export interface ConnectionResult {
  address: string;
  walletId: string;
}

/**
 * Safely check if a wallet module is selected in memory without throwing an uncaught getter exception.
 * If no active module is loaded, automatically set the wallet module or prompt the selection modal.
 */
export async function ensureWalletModuleSet(walletId?: string): Promise<boolean> {
  let isSet = false;
  try {
    isSet = !!StellarWalletsKit.selectedModule;
  } catch (e) {
    isSet = false;
  }

  if (isSet) return true;

  const targetWalletId = walletId || localStorage.getItem("wallet_id") || "freighter";
  logger.info(`[Wallet] Active wallet module not set in memory. Attempting setWallet(${targetWalletId})...`, "Wallet");

  try {
    StellarWalletsKit.setWallet(targetWalletId);
    return true;
  } catch (err) {
    logger.info("[Wallet] setWallet fallback failed. Prompting wallet authModal...", "Wallet");
    await StellarWalletsKit.authModal();
    return true;
  }
}

/**
 * Open the wallet kit modal to connect a Stellar wallet.
 */
export async function connectWallet(): Promise<ConnectionResult> {
  try {
    await StellarWalletsKit.disconnect();
  } catch (e) {
    // Ignore harmless disconnect errors on cold start
  }

  // authModal opens the selection modal and returns the connected address
  const result = await StellarWalletsKit.authModal();

  let walletId = "freighter";
  try {
    walletId = StellarWalletsKit.selectedModule?.productId || "freighter";
  } catch (e) {
    walletId = "freighter";
  }

  return {
    address: result.address,
    walletId,
  };
}

/**
 * Disconnect the active wallet.
 */
export async function disconnectWallet() {
  await StellarWalletsKit.disconnect();
}

/**
 * Request the connected wallet to sign a transaction XDR.
 */
export async function signTransaction(
  xdr: string,
  userAddress: string
): Promise<string> {
  // Ensure wallet module is set without throwing uncaught getter exceptions
  await ensureWalletModuleSet();

  try {
    const result = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      address: userAddress,
    });
    return result.signedTxXdr;
  } catch (err: any) {
    const errorStr = (err?.message || "") + " " + (err?.code || "") + " " + JSON.stringify(err || {});
    if (
      errorStr.includes("Please set the wallet first") ||
      errorStr.includes("not connected") ||
      errorStr.includes("Freighter is not connected") ||
      errorStr.includes("-3")
    ) {
      logger.info("[Wallet] Wallet connection lost or not authorized. Prompting wallet modal...", "Wallet");
      const authRes = await StellarWalletsKit.authModal();
      const result = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        address: authRes.address || userAddress,
      });
      return result.signedTxXdr;
    }
    throw err;
  }
}

/**
 * Generate a linking challenge transaction and request the wallet to sign it.
 */
export async function requestWalletLinkSignature(
  walletAddress: string,
  uid: string
): Promise<string> {
  // Use the wallet address as a source account with dummy sequence "0" (since we don't submit it to the ledger)
  const sourceAccount = new Account(walletAddress, "0");

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
  })
    .addOperation(
      Operation.manageData({
        name: "link_uid",
        value: uid, // Binds signature to this specific Firebase UID
      })
    )
    .setTimeout(TimeoutInfinite)
    .build();

  // Prompt wallet for signature
  return await signTransaction(tx.toXDR(), walletAddress);
}

/**
 * Cryptographically verify the signed challenge XDR.
 */
export function verifyWalletLinkSignature(
  signedXdr: string,
  expectedAddress: string,
  expectedUid: string,
  networkPassphrase: string
): boolean {
  try {
    const TESTNET_PASSPHRASES = [
      STELLAR_CONFIG.networkPassphrase,
      "Test SDF Network ; September 2015",
      "Testnet SDF Network ; September 2015",
    ];
    const PUBLIC_PASSPHRASE = "Public Global Stellar Network ; October 2015";

    const tx = new Transaction(signedXdr, networkPassphrase);

    logger.debug(`[verifyWalletLinkSignature] Starting verification check:
- expectedAddress: ${expectedAddress}
- expectedUid: ${expectedUid}
- primaryPassphrase: ${networkPassphrase}`, "Wallet");

    // 1. Verify transaction source matches the expected address
    if (tx.source !== expectedAddress) {
      logger.warn(`[verifyWalletLinkSignature] Mismatch: tx.source (${tx.source}) !== expectedAddress (${expectedAddress})`, "Wallet");
      return false;
    }

    // 2. Verify operations contains the correct manageData payload
    const op = tx.operations[0];
    if (!op || op.type !== "manageData") {
      logger.warn(`[verifyWalletLinkSignature] Mismatch: Operation is not manageData`, "Wallet");
      return false;
    }
    const opValueStr = op.value?.toString();
    if (op.name !== "link_uid" || opValueStr !== expectedUid) {
      logger.warn(`[verifyWalletLinkSignature] Mismatch: Operation name (${op.name}) or value (${opValueStr}) !== expectedUid (${expectedUid})`, "Wallet");
      return false;
    }

    // 3. Verify signature matches the source public key
    const keypair = Keypair.fromPublicKey(expectedAddress);

    // Check primary passphrase
    let txHash = tx.hash();
    let isSigned = tx.signatures.some((sig) => {
      const match = keypair.verify(txHash, sig.signature());
      logger.debug(`[verifyWalletLinkSignature] Primary verification: Signature verification returned ${match}`, "Wallet");
      return match;
    });

    // Fallback: Check alternate network passphrases for compatibility with older or different wallet/session contexts.
    if (!isSigned) {
      for (const altPassphrase of TESTNET_PASSPHRASES.filter((p) => p !== networkPassphrase)) {
        logger.debug(`[verifyWalletLinkSignature] Primary verification failed. Attempting alternate passphrase: ${altPassphrase}...`, "Wallet");

        const altTx = new Transaction(signedXdr, altPassphrase);
        const altTxHash = altTx.hash();
        isSigned = altTx.signatures.some((sig) => {
          const match = keypair.verify(altTxHash, sig.signature());
          logger.debug(`[verifyWalletLinkSignature] Alternative verification: Signature verification returned ${match}`, "Wallet");
          return match;
        });

        if (isSigned) break;
      }
    }

    if (!isSigned && networkPassphrase !== PUBLIC_PASSPHRASE) {
      logger.debug(`[verifyWalletLinkSignature] Primary verification failed. Attempting public network passphrase fallback: ${PUBLIC_PASSPHRASE}...`, "Wallet");
      const altTx = new Transaction(signedXdr, PUBLIC_PASSPHRASE);
      const altTxHash = altTx.hash();
      isSigned = altTx.signatures.some((sig) => {
        const match = keypair.verify(altTxHash, sig.signature());
        logger.debug(`[verifyWalletLinkSignature] Public network fallback verification returned ${match}`, "Wallet");
        return match;
      });
    }

    if (isSigned) {
      logger.success(`[verifyWalletLinkSignature] Cryptographic verification PASSED!`, "Wallet");
    } else {
      logger.error(`[verifyWalletLinkSignature] Cryptographic verification FAILED! No valid signatures found.`, "Wallet");
    }

    return isSigned;
  } catch (err: any) {
    logger.error(`[verifyWalletLinkSignature] Exception thrown during verification: ${err.message}`, "Wallet");
    return false;
  }
}
