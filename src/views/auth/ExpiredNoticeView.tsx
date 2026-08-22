import React, { useState } from "react";
import { AlertTriangle, LogOut, UserCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface ExpiredNoticeViewProps {
  profile: any;
  onLogout: () => Promise<void>;
}

export const ExpiredNoticeView: React.FC<ExpiredNoticeViewProps> = ({ profile, onLogout }) => {
  const { acknowledgeExpiration } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await acknowledgeExpiration();
    } catch (err: any) {
      alert("Failed to acknowledge expiration: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem", backgroundColor: "var(--bg-base)" }}>
      <div className="bank-card" style={{ maxWidth: "480px", width: "100%", padding: "2.5rem 2rem", textAlign: "center", border: "1px solid var(--accent-yellow)", boxShadow: "var(--shadow-floating)" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "9999px", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto", color: "#ffffff", boxShadow: "0 12px 24px -4px rgba(245, 158, 11, 0.4)" }}>
          <AlertTriangle size={32} />
        </div>

        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
          SK Position Term Ended
        </h2>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.55, marginBottom: "1.25rem" }}>
          Your term as <strong>SK {profile?.position?.toUpperCase() || "Official"}</strong> in Barangay {profile?.barangayName} has reached its completion date on <strong>{profile?.termEnd || "Current Term"}</strong>.
        </p>

        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.75rem", lineHeight: 1.5, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", padding: "0.95rem", borderRadius: "18px" }}>
          You can transition your profile to a <strong>Verified Youth Resident</strong> to continue auditing public projects and participating in voting.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <button className="btn btn-primary btn-lg w-100" onClick={handleAcknowledge} disabled={loading} style={{ width: "100%", height: "52px" }}>
            {loading ? "Processing..." : <>Continue as Resident <UserCheck size={18} /></>}
          </button>
          <button className="btn btn-outline-danger btn-lg w-100" onClick={onLogout} style={{ width: "100%", height: "52px" }}>
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiredNoticeView;
