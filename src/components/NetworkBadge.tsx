import React from "react";
import { STELLAR_CONFIG } from "../configuration/config";

export const NetworkBadge: React.FC = () => {
  return (
    <div className="network-badge">
      <span className="network-dot pulse"></span>
      <span className="network-name">Stellar {STELLAR_CONFIG.network.toUpperCase()}</span>
    </div>
  );
};
