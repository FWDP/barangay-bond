import React from "react";
import { ShieldAlert, ArrowRight } from "lucide-react";

interface LockedPageProps {
  pageName: string;
  onOpenUnlockDialog: () => void;
}

export const LockedPage: React.FC<LockedPageProps> = ({ pageName, onOpenUnlockDialog }) => {
  return (
    <div className="bank-card" style={{ maxWidth: "520px", margin: "4rem auto", padding: "2.5rem 1.75rem", textAlign: "center" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto", color: "#fbbf24" }}>
        <ShieldAlert size={32} />
      </div>
      <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
        {pageName} Locked
      </h3>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.5, margin: "0 0 1.5rem 0" }}>
        Your resident or official account is currently awaiting verification review. Complete the qualification steps to unlock full access.
      </p>
      <button className="btn btn-primary" onClick={onOpenUnlockDialog} style={{ width: "100%", height: "46px" }}>
        View Verification Checklist <ArrowRight size={15} />
      </button>
    </div>
  );
};

export default LockedPage;
