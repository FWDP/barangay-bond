import React from "react";
import { STELLAR_CONFIG } from "../configuration/config";

export const NetworkBadge: React.FC = () => {
  const isTestnet = STELLAR_CONFIG.network.toLowerCase().includes("testnet");

  return (
    <div
      className="network-badge"
      title={`Connected to Stellar ${STELLAR_CONFIG.network.toUpperCase()} RPC Vault`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-primary)",
        padding: "0.3rem 0.65rem",
        borderRadius: "9999px",
        fontSize: "0.74rem",
        fontWeight: 800,
        color: "var(--text-primary)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)"
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: isTestnet ? "var(--accent-blue)" : "var(--accent-green)",
          display: "inline-block",
          boxShadow: isTestnet ? "0 0 8px var(--accent-blue-glow)" : "0 0 8px var(--accent-green-glow)"
        }}
      />
      <span>Stellar {STELLAR_CONFIG.network.toUpperCase()}</span>
    </div>
  );
};

export default NetworkBadge;
