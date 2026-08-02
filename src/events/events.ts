import { scValToNative } from "@stellar/stellar-sdk";
import { rpcServer } from "../rpc/rpc";
import { STELLAR_CONFIG } from "../configuration/config";
import type { EventLog } from "../types";

export type EventListener = (logs: EventLog[]) => void;

class ContractEventsListener {
  private listeners: Set<EventListener> = new Set();
  private isPolling = false;
  private lastLedger = 0;
  private intervalId: any = null;

  constructor() {
    this.initLedger();
  }

  /**
   * Fetch the current latest ledger sequence to initialize our polling offset.
   */
  private async initLedger() {
    try {
      const response = await rpcServer.getLatestLedger();
      this.lastLedger = response.sequence;
    } catch (err) {
      console.error("Failed to initialize starting ledger:", err);
      // Fallback: estimate ledger sequence or default to 0
      this.lastLedger = 0;
    }
  }

  public subscribe(listener: EventListener) {
    this.listeners.add(listener);
    if (!this.isPolling) {
      this.startPolling();
    }
  }

  public unsubscribe(listener: EventListener) {
    this.listeners.delete(listener);
    if (this.listeners.size === 0 && this.isPolling) {
      this.stopPolling();
    }
  }

  private startPolling() {
    this.isPolling = true;
    this.intervalId = setInterval(() => this.pollEvents(), 5000); // Poll every 5 seconds
  }

  private stopPolling() {
    this.isPolling = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Poll events from the contract since the last check sequence.
   */
  private async pollEvents() {
    if (this.lastLedger === 0) {
      await this.initLedger();
      return;
    }

    try {
      // Query events starting from our last checked ledger
      const response = await rpcServer.getEvents({
        startLedger: this.lastLedger,
        filters: [
          {
            type: "contract",
            contractIds: [STELLAR_CONFIG.contractId],
          },
        ],
        limit: 50,
      });

      const events = response.events || [];
      if (events.length === 0) {
        // If no events, bump ledger sequence if possible
        const latest = await rpcServer.getLatestLedger();
        if (latest.sequence > this.lastLedger) {
          this.lastLedger = latest.sequence;
        }
        return;
      }

      const logs: EventLog[] = [];
      let maxSequence = this.lastLedger;

      for (const event of events) {
        if (event.ledger > maxSequence) {
          maxSequence = event.ledger;
        }

        try {
          const parsed = this.parseContractEvent(event);
          if (parsed) {
            logs.push(parsed);
          }
        } catch (err) {
          console.error("Failed to parse event:", event, err);
        }
      }

      // Next poll starts after the highest ledger we processed
      this.lastLedger = maxSequence + 1;

      if (logs.length > 0) {
        // Notify subscribers
        this.listeners.forEach((listener) => listener(logs));
      }
    } catch (err) {
      console.error("Error polling contract events:", err);
    }
  }

  /**
   * Parse a raw RPC event into a human-readable EventLog struct.
   */
  private parseContractEvent(event: any): EventLog | null {
    const topics: any[] = event.topic || [];
    if (topics.length === 0) return null;

    // Convert topics and value to native JS representations
    const eventName = scValToNative(topics[0]);
    const nativeVal = event.value ? scValToNative(event.value) : null;

    let type: EventLog["type"] = "unknown";
    let details = "";

    // Parse specific events based on the struct names defined in our contract
    switch (eventName) {
      case "ResidentVerifiedEvent": {
        const resident = scValToNative(topics[1]);
        const isYouth = !!nativeVal?.is_youth;
        type = "resident";
        details = `Barangay Admin verified resident [${this.truncateAddress(
          resident
        )}] as ${isYouth ? "Youth Resident (Voter)" : "Non-Youth"}.`;
        break;
      }
      case "SKOfficialVerifiedEvent": {
        const official = scValToNative(topics[1]);
        const isSk = !!nativeVal?.is_sk;
        type = "sk_offic";
        details = `Barangay Admin verified [${this.truncateAddress(
          official
        )}] as ${isSk ? "Active SK Official" : "Inactive"}.`;
        break;
      }
      case "ProjectCreatedEvent": {
        const id = scValToNative(topics[1]);
        const creator = scValToNative(topics[2]);
        const budgetStroops = BigInt(nativeVal?.budget || 0);
        const budgetXlm = (Number(budgetStroops) / 10000000).toFixed(2);
        type = "proj_new";
        details = `SK Official [${this.truncateAddress(
          creator
        )}] created Project #${id} with a budget of ${budgetXlm} XLM. Escrow locked, Phase 1 mobilization fund released.`;
        break;
      }
      case "MilestoneProofSubmittedEvent": {
        const projectId = scValToNative(topics[1]);
        const milestoneIndex = Number(nativeVal?.milestone_index || 0);
        const proofUrl = (nativeVal?.proof_url || "").toString();
        type = "proof_up";
        details = `Project #${projectId}: Proof for Milestone ${milestoneIndex} uploaded by SK Official. Proof link: ${proofUrl}`;
        break;
      }
      case "MilestoneVotedEvent": {
        const projectId = scValToNative(topics[1]);
        const voter = scValToNative(topics[2]);
        const approve = !!nativeVal?.approve;
        type = "vote";
        details = `Project #${projectId}: Verified resident [${this.truncateAddress(
          voter
        )}] voted ${approve ? "APPROVE" : "REJECT"}.`;
        break;
      }
      case "MilestoneApprovedEvent": {
        const projectId = scValToNative(topics[1]);
        const milestoneIndex = Number(nativeVal?.milestone_index || 0);
        const releasedStroops = BigInt(nativeVal?.amount_released || 0);
        const releasedXlm = (Number(releasedStroops) / 10000000).toFixed(2);
        type = "proj_done";
        details = `🎉 Project #${projectId} Milestone ${milestoneIndex} APPROVED! Released remaining escrow of ${releasedXlm} XLM. Project completed successfully!`;
        break;
      }
      case "MilestoneRejectedEvent": {
        const projectId = scValToNative(topics[1]);
        const milestoneIndex = Number(nativeVal?.milestone_index || 0);
        type = "proj_rej";
        details = `⚠️ Project #${projectId} Milestone ${milestoneIndex} REJECTED by youth vote. Escrow remains locked pending resolution.`;
        break;
      }
      default:
        // Ignore unmapped events
        return null;
    }

    return {
      id: event.id,
      type,
      timestamp: event.ledgerClosedAt || new Date().toISOString(),
      txHash: event.txHash,
      details,
    };
  }

  private truncateAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
  }
}

export const eventsListener = new ContractEventsListener();
