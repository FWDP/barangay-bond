import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLoading, type LoadingCategory } from "../contexts/LoadingContext";
import { Sparkles, Database, Zap, RefreshCw, KeyRound, CheckCircle2, X, ShieldCheck } from "lucide-react";

interface CategoryConfig {
  color: string;
  gradient: string;
  bgGlow: string;
  borderGlow: string;
  icon: React.ReactNode;
  badgeText: string;
  telemetry: string;
}

const CATEGORY_CONFIGS: Record<LoadingCategory, CategoryConfig> = {
  ai: {
    color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #06b6d4 100%)",
    bgGlow: "rgba(99, 102, 241, 0.16)",
    borderGlow: "rgba(99, 102, 241, 0.35)",
    icon: <Sparkles size={28} />,
    badgeText: "🧠 GEMINI 2.5 FLASH NEURAL PIPELINE",
    telemetry: "Google Gemini 2.5 Flash • Philippine SRP & DTI Benchmark Engine",
  },
  crud: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    bgGlow: "rgba(16, 185, 129, 0.16)",
    borderGlow: "rgba(16, 185, 129, 0.35)",
    icon: <Database size={26} />,
    badgeText: "💾 FIRESTORE ENCRYPTED LEDGER WRITE",
    telemetry: "Firestore Cloud Engine • Instant Civic Ledger Persistence",
  },
  soroban: {
    color: "#0284c7",
    gradient: "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)",
    bgGlow: "rgba(2, 132, 199, 0.16)",
    borderGlow: "rgba(2, 132, 199, 0.35)",
    icon: <Zap size={26} />,
    badgeText: "⚡ STELLAR SOROBAN CONTRACT EXECUTION",
    telemetry: "Stellar Soroban RPC Consensus • Cryptographic Multi-Sig Escrow",
  },
  sync: {
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    bgGlow: "rgba(139, 92, 246, 0.16)",
    borderGlow: "rgba(139, 92, 246, 0.35)",
    icon: <RefreshCw size={26} style={{ animation: "spinSlow 2s linear infinite" }} />,
    badgeText: "🌐 LEDGER STATE RE-SYNCHRONIZATION",
    telemetry: "Re-aligning Local Workspace with On-Chain Ledger State",
  },
  auth: {
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
    bgGlow: "rgba(245, 158, 11, 0.16)",
    borderGlow: "rgba(245, 158, 11, 0.35)",
    icon: <KeyRound size={26} />,
    badgeText: "🛡️ CRYPTOGRAPHIC IDENTITY VERIFICATION",
    telemetry: "Ed25519 Cryptographic Signature Verification",
  },
};

export const UniversalLoadingOverlay: React.FC = () => {
  const { loadingState, stopLoading } = useLoading();
  const { isLoading, category, title, message, steps, currentStepIndex = 0, cancellable, onCancel } = loadingState;

  // Failsafe 35s timeout guard
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      console.warn("⚠️ [Universal Loading] Safety timeout triggered (35s). Stopping loader.");
      stopLoading();
    }, 35000);
    return () => clearTimeout(timer);
  }, [isLoading, stopLoading]);

  if (!isLoading) return null;

  const config = CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.crud;
  const totalSteps = steps.length;
  const progressPct = totalSteps > 0 
    ? Math.min(100, Math.round(((currentStepIndex + 0.6) / totalSteps) * 100))
    : 70;

  return createPortal(
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 100000, 
        backdropFilter: "blur(12px)", 
        background: "rgba(15, 23, 42, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem"
      }}
    >
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: "500px", 
          width: "100%",
          textAlign: "center", 
          position: "relative", 
          padding: "2.2rem 2rem", 
          borderRadius: "28px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-primary)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 40px " + config.bgGlow,
          overflow: "hidden"
        }}
      >
        {/* Top Gradient Shimmer Bar */}
        <div 
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: config.gradient,
          }}
        />

        {/* Cancellable Close Button */}
        {cancellable && (
          <button
            type="button"
            onClick={() => {
              if (onCancel) onCancel();
              stopLoading();
            }}
            style={{
              position: "absolute",
              top: "1.1rem",
              right: "1.1rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease"
            }}
            title="Cancel Operation"
          >
            <X size={15} />
          </button>
        )}

        {/* Multi-Ring Orbital Cybernetic Emblem */}
        <div style={{ position: "relative", width: "88px", height: "88px", margin: "0 auto 1.25rem auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Outer Ambient Glow Ring */}
          <div 
            style={{ 
              position: "absolute", 
              inset: "-6px", 
              borderRadius: "50%", 
              background: config.gradient, 
              opacity: 0.25, 
              filter: "blur(10px)",
              animation: "pulseGlow 2.5s ease-in-out infinite"
            }} 
          />

          {/* Outer Rotating Counter-Clockwise Dashed Track */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px dashed ${config.color}`,
              opacity: 0.6,
              animation: "spinSlow 8s linear infinite reverse",
            }}
          />

          {/* Middle Rotating Clockwise Ring */}
          <div
            style={{
              position: "absolute",
              inset: "6px",
              borderRadius: "50%",
              border: `1.5px solid transparent`,
              borderTopColor: config.color,
              borderRightColor: config.color,
              animation: "spinSlow 3s cubic-bezier(0.4, 0, 0.2, 1) infinite",
            }}
          />

          {/* Inner Glowing Center Emblem Container */}
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "20px",
              background: config.bgGlow,
              border: `1px solid ${config.borderGlow}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: config.color,
              boxShadow: `0 8px 16px -4px ${config.bgGlow}`,
              animation: "pulseGlow 2s ease-in-out infinite",
            }}
          >
            {config.icon}
          </div>
        </div>

        {/* Frosted Category Status Badge with Live Pulsing Indicator */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", background: config.bgGlow, border: `1px solid ${config.borderGlow}`, padding: "0.3rem 0.8rem", borderRadius: "999px", marginBottom: "0.85rem" }}>
          <span 
            style={{ 
              width: "7px", 
              height: "7px", 
              borderRadius: "50%", 
              background: config.color, 
              boxShadow: `0 0 8px ${config.color}`,
              animation: "pulseGlow 1.2s ease-in-out infinite" 
            }} 
          />
          <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em", color: config.color }}>
            {config.badgeText}
          </span>
        </div>

        {/* Title & Message */}
        <h3 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-primary)", margin: "0 0 0.35rem 0", letterSpacing: "-0.02em" }}>
          {title || "Executing Verified Civic Action..."}
        </h3>
        <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.45, margin: "0 0 1.25rem 0" }}>
          {message || "Please keep this tab open while the system finalizes cryptographic state verification."}
        </p>

        {/* Live Progress Bar & Counter Strip */}
        {totalSteps > 0 && (
          <div style={{ marginBottom: "1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.35rem", fontWeight: 700 }}>
              <span>Pipeline Progress</span>
              <span style={{ color: config.color, fontWeight: 800 }}>
                Step {currentStepIndex + 1} of {totalSteps} • {progressPct}%
              </span>
            </div>
            <div style={{ height: "6px", width: "100%", background: "var(--bg-elevated)", borderRadius: "999px", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
              <div 
                style={{ 
                  height: "100%", 
                  width: `${progressPct}%`, 
                  background: config.gradient, 
                  borderRadius: "999px",
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
                }} 
              />
            </div>
          </div>
        )}

        {/* Multi-Step Checklist with Animated State */}
        {totalSteps > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", textAlign: "left", marginBottom: "1.2rem" }}>
            {steps.map((step, idx) => {
              const isCompleted = step.status === "completed" || idx < currentStepIndex;
              const isCurrent = step.status === "active" || idx === currentStepIndex;

              return (
                <div
                  key={idx}
                  style={{
                    background: isCurrent 
                      ? "linear-gradient(90deg, " + config.bgGlow + " 0%, var(--bg-elevated) 100%)" 
                      : isCompleted 
                      ? "rgba(16, 185, 129, 0.04)" 
                      : "var(--bg-surface)",
                    border: `1px solid ${
                      isCurrent 
                        ? config.borderGlow 
                        : isCompleted 
                        ? "rgba(16, 185, 129, 0.25)" 
                        : "var(--border-subtle)"
                    }`,
                    borderRadius: "14px",
                    padding: "0.65rem 0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.6rem",
                    fontSize: "0.82rem",
                    boxShadow: isCurrent ? `0 0 16px ${config.bgGlow}` : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    {isCompleted ? (
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-green)" }}>
                        <CheckCircle2 size={14} />
                      </div>
                    ) : isCurrent ? (
                      <div style={{ position: "relative", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div 
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: "50%",
                            border: `2px solid ${config.color}`,
                            borderTopColor: "transparent",
                            animation: "spinSlow 0.9s linear infinite",
                          }}
                        />
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: config.color }} />
                      </div>
                    ) : (
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700 }}>
                        {idx + 1}
                      </div>
                    )}

                    <span 
                      style={{ 
                        color: isCurrent ? "var(--text-primary)" : isCompleted ? "var(--text-secondary)" : "var(--text-muted)", 
                        fontWeight: isCurrent ? 800 : isCompleted ? 600 : 500,
                        letterSpacing: "-0.01em"
                      }}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Status Badge Tag */}
                  <div>
                    {isCompleted ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--accent-green)", background: "rgba(16, 185, 129, 0.12)", padding: "0.15rem 0.45rem", borderRadius: "6px" }}>
                        ✓ DONE
                      </span>
                    ) : isCurrent ? (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: config.color, background: config.bgGlow, padding: "0.15rem 0.45rem", borderRadius: "6px", border: `1px solid ${config.borderGlow}` }}>
                        ACTIVE
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)" }}>
                        QUEUED
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Real-World Telemetry & Cryptographic Security Footer */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", color: "var(--text-muted)", fontSize: "0.72rem" }}>
          <ShieldCheck size={14} style={{ color: "var(--role-accent)" }} />
          <span>{config.telemetry}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UniversalLoadingOverlay;
