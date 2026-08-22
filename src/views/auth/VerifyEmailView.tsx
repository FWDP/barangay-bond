import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Mail, LogOut, CheckCircle2 } from "lucide-react";

interface StatusScreenProps {
  profile: any;
  onLogout: () => Promise<void>;
}

export const VerifyEmailView: React.FC<StatusScreenProps> = ({ profile, onLogout }) => {
  const { sendVerificationEmail, checkEmailVerificationStatus, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendVerificationEmail();
      setEmailSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const isVerified = await checkEmailVerificationStatus();
      if (!isVerified) {
        setError("Email not verified yet. Please click the activation link in your inbox first.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify email status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem", backgroundColor: "var(--bg-base)" }}>
      <div
        className="bank-card"
        style={{
          maxWidth: "500px",
          width: "100%",
          padding: "2.5rem 2rem",
          textAlign: "center",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-floating)",
        }}
      >
        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "9999px",
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem auto",
            color: "#ffffff",
            boxShadow: "0 12px 24px -4px rgba(245, 158, 11, 0.35)",
          }}
        >
          <Mail size={32} />
        </div>

        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
          Activate Your Account
        </h2>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.55, marginBottom: "1.5rem" }}>
          Please verify your email address (<strong>{user?.email || profile?.email}</strong>) to continue with identity document submission.
        </p>

        {error && (
          <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "16px", padding: "0.85rem 1rem", color: "var(--accent-danger)", fontSize: "0.85rem", textAlign: "left", marginBottom: "1.25rem" }}>
            {error}
          </div>
        )}

        {emailSent && (
          <div style={{ background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)", borderRadius: "16px", padding: "0.85rem 1rem", color: "var(--role-badge-color)", fontSize: "0.85rem", textAlign: "left", marginBottom: "1.25rem", fontWeight: 700 }}>
            ✉️ Verification email dispatched! Check your inbox or spam folder.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.5rem" }}>
          <button
            className="btn btn-primary btn-lg w-100"
            style={{ width: "100%", height: "52px" }}
            onClick={handleSendEmail}
            disabled={loading || cooldown > 0}
          >
            {loading ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : emailSent ? "Resend Activation Email" : "Send Activation Email"}
          </button>

          <button
            className="btn btn-outline btn-lg w-100"
            style={{ width: "100%", height: "52px" }}
            onClick={handleCheckStatus}
            disabled={loading}
          >
            {loading ? "Verifying..." : <>I Verified My Email <CheckCircle2 size={18} /></>}
          </button>
        </div>

        <button
          className="btn btn-outline-danger w-100"
          onClick={onLogout}
          style={{ height: "46px" }}
        >
          <LogOut size={16} /> Log Out
        </button>
      </div>
    </div>
  );
};

export default VerifyEmailView;
