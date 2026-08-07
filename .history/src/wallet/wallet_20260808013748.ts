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

// Initialize the static class once
StellarWalletsKit.init({
  network,
  modules: [
    new FreighterModule(),
    new xBullModule(),
    new AlbedoModule(),
    new LobstrModule(),
  ],
});

export interface ConnectionResult {
  address: string;
  walletId: string;
}

/**
 * Open the wallet kit modal to connect a Stellar wallet.
 */
export async function connectWallet(): Promise<ConnectionResult> {
  // authModal opens the selection modal and returns the connected address
  const result = await StellarWalletsKit.authModal();

  // Get the selected wallet ID from the active static module
  const walletId = StellarWalletsKit.selectedModule?.productId || "freighter";

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
  const result = await StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
    address: userAddress,
  });
  return result.signedTxXdr;
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
