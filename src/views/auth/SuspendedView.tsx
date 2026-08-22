import React from "react";
import { LogOut, ShieldAlert } from "lucide-react";

interface SuspendedViewProps {
  profile: any;
  onLogout: () => Promise<void>;
}

export const SuspendedView: React.FC<SuspendedViewProps> = ({ profile, onLogout }) => {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem", backgroundColor: "var(--bg-base)" }}>
      <div className="bank-card" style={{ maxWidth: "480px", width: "100%", padding: "2.5rem 2rem", textAlign: "center", border: "1px solid var(--accent-danger)", boxShadow: "var(--shadow-floating)" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "9999px", background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto", color: "#ffffff", boxShadow: "0 12px 24px -4px rgba(239, 68, 68, 0.4)" }}>
          <ShieldAlert size={36} />
        </div>

        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
          Account Suspended
        </h2>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.55, marginBottom: "1.5rem" }}>
          Your profile (<strong>{profile?.email}</strong>) has been suspended by the Barangay Secretariat due to audit compliance issues.
        </p>

        <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "18px", padding: "1rem", color: "var(--accent-danger)", fontSize: "0.84rem", textAlign: "left", marginBottom: "1.75rem", lineHeight: 1.45 }}>
          <strong>Compliance Notice:</strong> Access to projects, escrows, and community voting rights has been disabled. If you believe this is an error, please reach out to your local Barangay Secretariat.
        </div>

        <button className="btn btn-outline-danger btn-lg w-100" onClick={onLogout} style={{ width: "100%", height: "52px" }}>
          <LogOut size={18} /> Log Out
        </button>
      </div>
    </div>
  );
};

export default SuspendedView;
