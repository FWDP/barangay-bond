import { StellarWalletsKit, Networks } from "@creit-tech/stellar-wallets-kit";
import { FreighterModule } from "@creit-tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit-tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule } from "@creit-tech/stellar-wallets-kit/modules/albedo";
import { LobstrModule } from "@creit-tech/stellar-wallets-kit/modules/lobstr";
import { STELLAR_CONFIG } from "../configuration/config";

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
