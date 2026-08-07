import { useState, useEffect, useCallback } from "react";
import { getProject, getProjectCount } from "../rpc/rpc";
import type { Project, EventLog } from "../types";
import { eventsListener } from "../events/events";
import { useWallet } from "../contexts/WalletContext";
import { useAuth } from "../contexts/AuthContext";

export function useContractState() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [xlmBalance, setXlmBalance] = useState("0.00");
  const [error, setError] = useState<string | null>(null);
  
  const { address } = useWallet();
  const { profile, refreshRoles } = useAuth();

  const targetAddress = address || profile?.walletAddress;

  /**
   * Load the native XLM token balance of the connected user or linked profile wallet.
   */
  const loadBalance = useCallback(async () => {
    if (!targetAddress) {
      setXlmBalance("0.00");
      return;
    }
    try {
      // Query the balance using Horizon accounts endpoint
      const response = await fetch(
        `https://horizon-testnet.stellar.org/accounts/${targetAddress}`
      );
      if (response.ok) {
        const data = await response.json();
        const native = data.balances.find((b: any) => b.asset_type === "native");
        if (native) {
          setXlmBalance(Number(native.balance).toFixed(2));
        }
      }
    } catch (err) {
      console.error("Failed to load account XLM balance:", err);
    }
  }, [targetAddress]);

  /**
   * Fetch all projects and milestones from the Soroban contract state.
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const count = await getProjectCount();
      const loadedProjects: Project[] = [];
      
      for (let i = 1; i <= count; i++) {
        try {
          const proj = await getProject(i);
          loadedProjects.push(proj);
        } catch (err) {
          console.error(`Failed to load project #${i}:`, err);
        }
      }

      // Sort by ID descending (newest first)
      loadedProjects.sort((a, b) => b.id - a.id);
      setProjects(loadedProjects);
      await loadBalance();
    } catch (err: any) {
      console.error("Failed to load contract state:", err);
      setError(err.message || "Failed to load projects from the blockchain.");
    } finally {
      setLoading(false);
    }
  }, [loadBalance]);

  // Handle real-time contract event triggers
  useEffect(() => {
    const handleEvents = (newLogs: EventLog[]) => {
      // Prepend new logs to the local log list
      setEventLogs((prev) => [...newLogs, ...prev]);
      
      // Trigger data refresh and roles update
      refresh();
      refreshRoles();
    };

    eventsListener.subscribe(handleEvents);
    return () => {
      eventsListener.unsubscribe(handleEvents);
    };
  }, [refresh, refreshRoles]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh, address, profile?.walletAddress]);

  return {
    projects,
    eventLogs,
    loading,
    xlmBalance,
    error,
    refresh,
  };
}
