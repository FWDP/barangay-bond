import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  TimeoutInfinite,
  nativeToScVal,
  scValToNative,
  Transaction,
  xdr,
} from "@stellar/stellar-sdk";
import { STELLAR_CONFIG } from "../configuration/config";
import type { Project, Milestone } from "../types";

export const rpcServer = new rpc.Server(STELLAR_CONFIG.rpcUrl);

// Helper dummy address to build simulation transactions
const DUMMY_SOURCE = "GDV44D7S6FDUT35QUOVE7Q3BNY4TNFCUZQX7BN66OLLSZDZGT47GDGN7";

/**
 * Helper to fetch the current sequence number of an account from Horizon.
 */
export async function fetchAccount(address: string): Promise<Account> {
  try {
    const response = await fetch(
      `${STELLAR_CONFIG.horizonUrl}/accounts/${address}`
    );
    if (!response.ok) {
      throw new Error(`Account ${address} not found or inactive`);
    }
    const data = await response.json();
    return new Account(address, data.sequence);
  } catch (err) {
    // If account doesn't exist on-chain yet, default to sequence 0
    return new Account(address, "0");
  }
}

/**
 * Simulates a contract read/view call.
 */
async function simulateCall(method: string, args: xdr.ScVal[] = []): Promise<any> {
  const contract = new Contract(STELLAR_CONFIG.contractId);
  const operation = contract.call(method, ...args);

  const sourceAccount = new Account(DUMMY_SOURCE, "0");
  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(TimeoutInfinite)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);

  if ("error" in sim && sim.error) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  // Under newer SDK versions, sim.result contains the retval directly. Fallback to results array for older versions.
  const simAny = sim as any;
  const retval = simAny.result?.retval || (simAny.results?.[0]?.retval);
  if (retval) {
    return scValToNative(retval);
  }

  return null;
}

/**
 * Read the state of a project by ID.
 */
export async function getProject(projectId: number): Promise<Project> {
  const result = await simulateCall("get_project", [nativeToScVal(projectId, { type: "u32" })]);
  
  // Format the returned struct into our clean TypeScript interface
  return {
    id: Number(result.id),
    name: result.name.toString(),
    description: result.description.toString(),
    budget: (Number(result.budget) / 10000000).toFixed(7), // Convert stroops back to XLM decimal format
    creator: result.creator.toString(),
    totalPhases: Number(result.total_phases || result.totalPhases || 1),
    currentPhase: Number(result.current_phase || result.currentPhase || 1),
    status: Number(result.status),
  };
}

/**
 * Read the state of a specific milestone of a project.
 */
export async function getMilestone(projectId: number, milestoneIndex: number): Promise<Milestone> {
  const result = await simulateCall("get_milestone", [
    nativeToScVal(projectId, { type: "u32" }),
    nativeToScVal(milestoneIndex, { type: "u32" }),
  ]);

  return {
    index: Number(result.index),
    percentage: Number(result.percentage),
    proofUrl: result.proof_url ? result.proof_url.toString() : "",
    votesApprove: Number(result.votes_approve || 0),
    votesReject: Number(result.votes_reject || 0),
    status: Number(result.status),
  };
}

/**
 * Read project together with all its on-chain milestones.
 */
export async function getProjectWithMilestones(projectId: number): Promise<Project> {
  const project = await getProject(projectId);
  const milestones: Milestone[] = [];

  for (let i = 1; i <= project.totalPhases; i++) {
    try {
      const ms = await getMilestone(projectId, i);
      milestones.push(ms);
    } catch {
      // Graceful fallback for legacy single-milestone contracts on testnet
      milestones.push({
        index: i,
        percentage: Math.floor(100 / (project.totalPhases || 1)),
        proofUrl: "",
        votesApprove: 0,
        votesReject: 0,
        status: project.status === 1 ? 2 : 0,
      });
    }
  }

  project.milestones = milestones;
  
  // For convenient backwards-compatibility in UI components:
  const ms1 = milestones.find((m) => m.index === 1);
  const msCurrent = milestones.find((m) => m.index === project.currentPhase) || milestones[1] || ms1;
  
  project.mobilizationPct = ms1?.percentage || 50;
  if (msCurrent) {
    project.milestone1Proof = msCurrent.proofUrl || "";
    project.milestone1VotesApprove = msCurrent.votesApprove || 0;
    project.milestone1VotesReject = msCurrent.votesReject || 0;
    project.milestone1Status = msCurrent.status;
  }

  return project;
}

/**
 * Check if a resident is verified as a youth resident.
 */
export async function isResidentVerified(address: string): Promise<boolean> {
  const result = await simulateCall("is_resident_verified", [
    nativeToScVal(address, { type: "address" }),
  ]);
  return !!result;
}

/**
 * Check if an address is verified as an SK official.
 */
export async function isSKOfficial(address: string): Promise<boolean> {
  const result = await simulateCall("is_sk_official", [
    nativeToScVal(address, { type: "address" }),
  ]);
  return !!result;
}

/**
 * Get total project count.
 */
export async function getProjectCount(): Promise<number> {
  const result = await simulateCall("get_project_count");
  return Number(result || 0);
}

/**
 * Build and prepare a Soroban contract write transaction.
 */
export async function buildWriteTransaction(
  userAddress: string,
  methodName: string,
  args: xdr.ScVal[]
): Promise<Transaction> {
  const sourceAccount = await fetchAccount(userAddress);
  const contract = new Contract(STELLAR_CONFIG.contractId);
  const operation = contract.call(methodName, ...args);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100", // Will be overwritten by prepareTransaction
    networkPassphrase: STELLAR_CONFIG.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(TimeoutInfinite)
    .build();

  // prepareTransaction simulates the transaction, registers footprints, and estimates the actual required fees.
  const preparedTx = await rpcServer.prepareTransaction(tx);
  return preparedTx as Transaction;
}
