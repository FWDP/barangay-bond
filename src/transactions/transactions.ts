import { nativeToScVal, Transaction, xdr } from "@stellar/stellar-sdk";
import { buildWriteTransaction, rpcServer } from "../rpc/rpc";
import { signTransaction } from "../wallet/wallet";
import type { TransactionStatus } from "../types";

/**
 * Polling helper to wait for transaction confirmation from the RPC server.
 */
async function pollTransactionStatus(
  txHash: string,
  onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
): Promise<string> {
  const maxAttempts = 30; // 30 seconds timeout
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const txResult = await rpcServer.getTransaction(txHash);
      
      if (txResult.status === "SUCCESS") {
        onStatusChange("Confirmed", txHash);
        return txHash;
      }
      
      if (txResult.status === "FAILED") {
        onStatusChange("Failed", txHash, "Transaction execution failed on-chain.");
        throw new Error("Transaction execution failed on-chain.");
      }
      
      // If status is still PENDING or NOT_FOUND, keep waiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err: any) {
      if (attempt === maxAttempts - 1) {
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
  onStatusChange("Pending");

  let preparedTx: Transaction;
  try {
    preparedTx = await buildWriteTransaction(userAddress, methodName, args);
  } catch (err: any) {
    console.error("Simulation / Build error:", err);
    onStatusChange("SimulationError", undefined, err.message || "Failed to simulate transaction.");
    throw err;
  }

  let signedTxXdr: string;
  try {
    const rawXdr = preparedTx.toXDR();
    signedTxXdr = await signTransaction(rawXdr, userAddress);
  } catch (err: any) {
    console.error("Signing error:", err);
    onStatusChange("WalletCancelled", undefined, err.message || "Transaction signing rejected by wallet.");
    throw err;
  }

  onStatusChange("Submitted");
  let txHash = "";
  try {
    const txObj = new Transaction(signedTxXdr, preparedTx.networkPassphrase);
    txHash = txObj.hash().toString("hex");
    const sendResponse = await rpcServer.sendTransaction(txObj);

    if (sendResponse.status === "ERROR") {
      onStatusChange("Failed", txHash, "Transaction failed submission.");
      throw new Error(`Submission failed: ${JSON.stringify(sendResponse)}`);
    }
  } catch (err: any) {
    console.error("Submission error:", err);
    onStatusChange("NetworkError", txHash, err.message || "RPC submission error.");
    throw err;
  }

  // Poll until transaction is finalized
  return await pollTransactionStatus(txHash, onStatusChange);
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
