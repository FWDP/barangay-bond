import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { userRepository } from "../repositories/user.repository";
import { ShieldCheck, Award, Sparkles, FileText, ArrowRight, X } from "lucide-react";

interface SKCelebrationModalProps {
  onOpenSKWorkspace?: () => void;
}

export const SKCelebrationModal: React.FC<SKCelebrationModalProps> = ({ onOpenSKWorkspace }) => {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!profile || dismissed) return null;

  const isSK = profile.role === "sk_official" && profile.status === "active";
  if (!isSK) return null;

  const localKey = `sk_promo_acknowledged_${profile.uid}`;
  const isLocallyAcknowledged = localStorage.getItem(localKey) === "true";

  // Only show if not acknowledged in DB and not acknowledged locally
  if (profile.acknowledgedPromotion || isLocallyAcknowledged) {
    return null;
  }

  const positionLabel = (profile.position || "Official").toUpperCase();
  const barangayLabel = profile.barangayName ? `Brgy. ${profile.barangayName}` : "Your Barangay";

  const handleAcknowledge = async () => {
    setIsSubmitting(true);
    try {
      localStorage.setItem(localKey, "true");
      await userRepository.updateUserProfile(profile.uid, {
        acknowledgedPromotion: true,
      });
      setDismissed(true);
      if (onOpenSKWorkspace) {
        onOpenSKWorkspace();
      }
    } catch (err) {
      console.error("Failed to acknowledge promotion:", err);
      setDismissed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => setDismissed(true)}
      style={{
        zIndex: 9999,
        background: "rgba(10, 15, 29, 0.82)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <div
        className="modal-content tap-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "520px",
          width: "100%",
          background: "var(--bg-surface)",
          border: "1.5px solid var(--border-primary)",
          borderRadius: "28px",
          padding: "2rem",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 35px rgba(0, 214, 101, 0.15)",
          position: "relative",
          textAlign: "center",
          animation: "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={handleAcknowledge}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        {/* Celebratory Crest Badge */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "26px",
            background: "linear-gradient(135deg, rgba(0, 214, 101, 0.2), rgba(0, 125, 254, 0.2))",
            border: "2px solid rgba(0, 214, 101, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem auto",
            boxShadow: "0 10px 25px rgba(0, 214, 101, 0.25)",
            position: "relative",
          }}
        >
          <Award size={42} style={{ color: "var(--accent-green)" }} />
          <div
            style={{
              position: "absolute",
              top: "-6px",
              right: "-6px",
              background: "var(--accent-yellow)",
              color: "#000",
              borderRadius: "50%",
              padding: "4px",
            }}
          >
            <Sparkles size={14} />
          </div>
        </div>

        {/* Title */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.8rem", borderRadius: "999px", background: "var(--accent-green-soft)", color: "var(--accent-green)", fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          <Sparkles size={14} /> Official Governance Mandate
        </div>

        <h2 style={{ fontSize: "1.65rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: "0 0 0.4rem 0" }}>
          Congratulations, {profile.name}!
        </h2>

        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: "1.5", margin: "0 0 1.5rem 0" }}>
          You have been officially appointed as <strong style={{ color: "var(--text-primary)" }}>SK {positionLabel}</strong> for <strong style={{ color: "var(--accent-green)" }}>{barangayLabel}</strong>.
        </p>

        {/* Term Duration Card */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "18px",
            padding: "1rem 1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            textAlign: "left",
          }}
        >
          <div>
            <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              Active Term Period
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.2rem" }}>
              {profile.termStart || "Current"} → {profile.termEnd || "End of Term"}
            </div>
          </div>
          <span className="badge badge-success" style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem", fontWeight: 800 }}>
            ● Active Seat
          </span>
        </div>

        {/* Powers & Mandate Breakdown */}
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--accent-blue-soft)", color: "var(--accent-blue)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
              <FileText size={15} />
            </div>
            <div>
              <strong style={{ fontSize: "0.86rem", color: "var(--text-primary)" }}>Draft Civic Proposals</strong>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>
                Submit milestone-based project grants to the Barangay Admin for smart contract escrow funding.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--accent-green-soft)", color: "var(--accent-green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
              <ShieldCheck size={15} />
            </div>
            <div>
              <strong style={{ fontSize: "0.86rem", color: "var(--text-primary)" }}>Upload Proofs & Unlock Tranches</strong>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>
                Submit deliverables for public resident consensus voting to release escrow funds on Stellar.
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action Button */}
        <button
          type="button"
          className="btn btn-primary btn-lg w-100 tap-scale"
          onClick={handleAcknowledge}
          disabled={isSubmitting}
          style={{
            height: "52px",
            borderRadius: "16px",
            fontWeight: 800,
            fontSize: "1rem",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            boxShadow: "0 10px 25px rgba(0, 214, 101, 0.3)",
          }}
        >
          <span>{isSubmitting ? "Accepting Mandate..." : "Accept Mandate & Enter SK Studio"}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>,
    document.body
  );
};
