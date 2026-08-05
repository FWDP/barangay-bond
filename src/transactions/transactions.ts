import { nativeToScVal, Transaction, xdr } from "@stellar/stellar-sdk";
import { buildWriteTransaction, rpcServer } from "../rpc/rpc";
import { signTransaction } from "../wallet/wallet";
import type { TransactionStatus } from "../types";
import { logger } from "../utils/logger";
import { DEBUG_MODE } from "../config/debug";

/**
 * Polling helper to wait for transaction confirmation from the RPC server.
 */
async function pollTransactionStatus(
  txHash: string,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void,
  correlationId?: string
): Promise<string> {
  const maxAttempts = 30; // 30 seconds timeout
  logger.blockchain(`Polling transaction status. Explorer: https://stellar.expert/explorer/testnet/tx/${txHash}`, "Soroban", { correlationId, transactionId: txHash });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const txResult = await rpcServer.getTransaction(txHash);
      logger.network(`Stellar RPC getTransaction call status: ${txResult.status}`, "StellarRPC", { correlationId, transactionId: txHash });
      
      if (txResult.status === "SUCCESS") {
        logger.success(`Transaction confirmed in ledger! Explorer: https://stellar.expert/explorer/testnet/tx/${txHash}`, "Soroban", {
          correlationId,
          transactionId: txHash,
          metadata: { txResult }
        });
        onStatusChange("Confirmed", txHash);
        return txHash;
      }
      
      if (txResult.status === "FAILED") {
        logger.error(`Transaction failed on-chain execution.`, "Soroban", {
          correlationId,
          transactionId: txHash,
          metadata: { result: txResult }
        });
        onStatusChange("Failed", txHash, "Transaction execution failed on-chain.");
        throw new Error("Transaction execution failed on-chain.");
      }
      
      // If status is still PENDING or NOT_FOUND, keep waiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err: any) {
      if (attempt === maxAttempts - 1) {
        logger.error(`Transaction final check failed: ${err.message}`, "Soroban", { correlationId, transactionId: txHash });
        onStatusChange("Expired", txHash, "Transaction timed out.");
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  
  onStatusChange("Expired", txHash, "Transaction timed out.");
  throw new Error("Transaction timed out.");
}

/**
 * High-level helper to execute any contract write operation.
 */
async function executeContractWrite(
  userAddress: string,
  methodName: string,
  args: xdr.ScVal[],
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  const correlationId = `TX-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const startTime = Date.now();
  logger.blockchain(`Preparing Soroban transaction write: method = ${methodName}`, "Soroban", {
    correlationId,
    metadata: { userAddress, argsCount: args.length }
  });

  onStatusChange("Pending");

  let preparedTx: Transaction;
  try {
    preparedTx = await buildWriteTransaction(userAddress, methodName, args);
    if (DEBUG_MODE) {
      logger.debug(`[Soroban Diagnostics] Simulation Details:
- Method: ${methodName}
- Target: ${userAddress}
- Fee: ${preparedTx.fee} stroops
- Passphrase: ${preparedTx.networkPassphrase}
- Envelope XDR: ${preparedTx.toEnvelope().toXDR("base64")}
      `, "Soroban", { correlationId });
    }
    logger.success(`Soroban write transaction successfully simulated & built. Footprint: ${preparedTx.fee} stroops`, "Soroban", {
      correlationId,
      durationMs: Date.now() - startTime,
      metadata: { fee: preparedTx.fee, memo: preparedTx.memo }
    });
  } catch (err: any) {
    logger.error(`Soroban transaction simulation/build failed: ${err.message}`, "Soroban", {
      correlationId,
      metadata: { error: err.toString() }
    });
    onStatusChange("SimulationError", undefined, err.message || "Failed to simulate transaction.");
    throw err;
  }

  let signedTxXdr: string;
  try {
    const rawXdr = preparedTx.toXDR();
    logger.blockchain("Awaiting user signature request via linked wallet...", "Wallet", { correlationId });
    signedTxXdr = await signTransaction(rawXdr, userAddress);
    logger.success("Transaction signed successfully by wallet extension.", "Wallet", { correlationId });
  } catch (err: any) {
    logger.warn(`Transaction signing canceled or failed: ${err.message}`, "Wallet", { correlationId });
    onStatusChange("WalletCancelled", undefined, err.message || "Transaction signing rejected by wallet.");
    throw err;
  }

  onStatusChange("Submitted");
  let txHash = "";
  try {
    const txObj = new Transaction(signedTxXdr, preparedTx.networkPassphrase);
    txHash = txObj.hash().toString("hex");
    logger.network(`Submitting transaction to Stellar RPC endpoint. Hash: ${txHash}`, "StellarRPC", { correlationId, transactionId: txHash });
    const sendResponse = await rpcServer.sendTransaction(txObj);

    if (sendResponse.status === "ERROR") {
      logger.error(`Stellar RPC submission failed. Error response: ${JSON.stringify(sendResponse)}`, "StellarRPC", { correlationId, transactionId: txHash });
      onStatusChange("Failed", txHash, "Transaction failed submission.");
      throw new Error(`Submission failed: ${JSON.stringify(sendResponse)}`);
    }
  } catch (err: any) {
    logger.error(`Submission network failure: ${err.message}`, "StellarRPC", { correlationId, transactionId: txHash });
    onStatusChange("NetworkError", txHash, err.message || "RPC submission error.");
    throw err;
  }

  // Poll until transaction is finalized
  return await pollTransactionStatus(txHash, onStatusChange, correlationId);
}

/**
 * Verify a resident as a youth resident (Admin only).
 */
export async function verifyResident(
  adminAddress: string,
  residentAddress: string,
  isYouth: boolean,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  const args = [
    nativeToScVal(residentAddress, { type: "address" }),
    nativeToScVal(isYouth),
  ];
  return executeContractWrite(adminAddress, "verify_resident", args, onStatusChange);
}

/**
 * Verify an address as an SK Official (Admin only).
 */
export async function verifySKOfficial(
  adminAddress: string,
  officialAddress: string,
  isSK: boolean,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  const args = [
    nativeToScVal(officialAddress, { type: "address" }),
    nativeToScVal(isSK),
  ];
  return executeContractWrite(adminAddress, "verify_sk_official", args, onStatusChange);
}

/**
 * Create a new governance project with lock budget (SK Official only).
 */
export async function createProject(
  skAddress: string,
  projectName: string,
  budgetAmountXlm: number,
  description: string,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  // Convert XLM to stroops (7 decimal places)
  const budgetStroops = BigInt(Math.round(budgetAmountXlm * 10000000));
  const args = [
    nativeToScVal(skAddress, { type: "address" }),
    nativeToScVal(projectName),
    nativeToScVal(budgetStroops, { type: "i128" }),
    nativeToScVal(description),
  ];
  return executeContractWrite(skAddress, "create_project", args, onStatusChange);
}

/**
 * Submit milestone proof URL (SK Official only).
 */
export async function submitMilestoneProof(
  skAddress: string,
  projectId: number,
  milestoneIndex: number,
  proofUrl: string,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  const args = [
    nativeToScVal(skAddress, { type: "address" }),
    nativeToScVal(projectId, { type: "u32" }),
    nativeToScVal(milestoneIndex, { type: "u32" }),
    nativeToScVal(proofUrl),
  ];
  return executeContractWrite(skAddress, "submit_milestone_proof", args, onStatusChange);
}

/**
 * Vote to approve or reject a milestone (Verified Youth only).
 */
export async function voteMilestone(
  voterAddress: string,
  projectId: number,
  milestoneIndex: number,
  approve: boolean,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  const args = [
    nativeToScVal(voterAddress, { type: "address" }),
    nativeToScVal(projectId, { type: "u32" }),
    nativeToScVal(milestoneIndex, { type: "u32" }),
    nativeToScVal(approve),
  ];
  return executeContractWrite(voterAddress, "vote_milestone", args, onStatusChange);
}

/**
 * Refund the remaining project escrow funds back to the creator after rejection.
 */
export async function refundProject(
  skAddress: string,
  projectId: number,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  const args = [
    nativeToScVal(skAddress, { type: "address" }),
    nativeToScVal(projectId, { type: "u32" }),
  ];
  return executeContractWrite(skAddress, "refund_project", args, onStatusChange);
}
