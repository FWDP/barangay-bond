import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ShieldCheck, LogOut } from "lucide-react";

interface UnlockDialogProps {
  profile: any;
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const UnlockDialog: React.FC<UnlockDialogProps> = ({ profile, user, isOpen, onClose, onLogout }) => {
  const { sendVerificationEmail, checkEmailVerificationStatus } = useAuth();
  const [checking, setChecking] = useState(false);
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

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    setError(null);
    try {
      await sendVerificationEmail();
      setEmailSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to send verification email.");
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setError(null);
    try {
      const isVerified = await checkEmailVerificationStatus();
      if (!isVerified) {
        setError("Email verification link has not been clicked yet. Please check your inbox and verify.");
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to sync verification status.");
    } finally {
      setChecking(false);
    }
  };

  const isPendingReview = profile?.status === "pending";
  const isPendingEmail = profile?.status === "pending_email_verification";
  const isApproved = profile?.verificationStatus === "approved" || profile?.status === "pending_email_verification" || profile?.status === "active";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
        <div className="bottom-sheet-handle" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                Verification Tier Status
              </h3>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Barangay Bond account qualification checklist</span>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "12px", padding: "0.75rem", color: "var(--accent-danger)", fontSize: "0.82rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Account Registered", done: true, extra: `Linked: ${profile?.email || user?.email}` },
            { label: "ID Credentials Uploaded", done: true, extra: "Verified civilian identification" },
            { label: "AI Verification Audit", done: true, extra: `Confidence score: ${profile?.scores?.overallScore || 88}%` },
            { label: "Barangay Admin Review", done: isApproved, pending: isPendingReview, extra: isApproved ? "✓ Approved by Barangay Admin" : "Queued in verification desk" },
            { label: "Email Address Activated", done: user?.emailVerified || false, pending: isPendingEmail && !user?.emailVerified, extra: `Registered email: ${profile?.email}` },
            { label: "Civic Voting Activated", done: profile?.status === "active", extra: "Full cryptographic voting rights enabled" }
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", background: "var(--bg-elevated)", padding: "0.75rem 0.9rem", borderRadius: "14px", border: "1px solid var(--border-subtle)" }}>
              <span style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: step.done ? "var(--accent-green)" : step.pending ? "var(--accent-blue)" : "var(--bg-hover)",
                color: "var(--text-inverse)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 900,
                flexShrink: 0,
                marginTop: "1px"
              }}>
                {step.done ? "✓" : "⏳"}
              </span>
              <div>
                <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, color: step.done || step.pending ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {step.label}
                </span>
                {step.extra && (
                  <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{step.extra}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {isPendingEmail && !user?.emailVerified && (
            <>
              {emailSent && (
                <div style={{ background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)", borderRadius: "12px", padding: "0.65rem", color: "var(--role-badge-color)", fontSize: "0.8rem", textAlign: "center", fontWeight: 700 }}>
                  ✉️ Verification email sent! Check your inbox.
                </div>
              )}
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSendEmail} disabled={cooldown > 0}>
                  {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend Email"}
                </button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCheckStatus} disabled={checking}>
                  {checking ? "Verifying..." : "Refresh"}
                </button>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.3rem" }}>
            <button className="btn btn-outline-danger tap-scale" style={{ flex: 1 }} onClick={onLogout}>
              <LogOut size={15} /> Logout
            </button>
            <button className="btn btn-primary tap-scale" style={{ flex: 1.5 }} onClick={onClose}>
              Close Checklist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnlockDialog;
