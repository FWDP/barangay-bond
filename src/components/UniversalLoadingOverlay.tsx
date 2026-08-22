import React, { useEffect } from "react";
import { useLoading, type LoadingCategory } from "../contexts/LoadingContext";
import { Bot, Database, Zap, RefreshCw, KeyRound, CheckCircle2, Clock, X } from "lucide-react";

interface CategoryConfig {
  color: string;
  bgGlow: string;
  icon: React.ReactNode;
  badgeText: string;
}

const CATEGORY_CONFIGS: Record<LoadingCategory, CategoryConfig> = {
  ai: {
    color: "#00d665",
    bgGlow: "rgba(0, 214, 101, 0.18)",
    icon: <Bot size={28} />,
    badgeText: "🤖 AI NEURAL AUDIT IN PROGRESS",
  },
  crud: {
    color: "#00d665",
    bgGlow: "rgba(0, 214, 101, 0.18)",
    icon: <Database size={28} />,
    badgeText: "💾 FIRESTORE LEDGER WRITING",
  },
  soroban: {
    color: "#007dfe",
    bgGlow: "rgba(0, 125, 254, 0.18)",
    icon: <Zap size={28} />,
    badgeText: "⚡ STELLAR SOROBAN CONTRACT EXECUTION",
  },
  sync: {
    color: "#6366f1",
    bgGlow: "rgba(99, 102, 241, 0.18)",
    icon: <RefreshCw size={28} style={{ animation: "spin 1.5s linear infinite" }} />,
    badgeText: "🌐 LEDGER SYNCHRONIZATION",
  },
  auth: {
    color: "#38bdf8",
    bgGlow: "rgba(56, 189, 248, 0.18)",
    icon: <KeyRound size={28} />,
    badgeText: "🔑 IDENTITY & ENCRYPTION",
  },
};

export const UniversalLoadingOverlay: React.FC = () => {
  const { loadingState, stopLoading } = useLoading();
  const { isLoading, category, title, message, steps, currentStepIndex = 0, cancellable, onCancel } = loadingState;

  // Failsafe 30s timeout guard
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      console.warn("⚠️ [Universal Loading] Safety timeout triggered (30s). Stopping loader.");
      stopLoading();
    }, 30000);
    return () => clearTimeout(timer);
  }, [isLoading, stopLoading]);

  if (!isLoading) return null;

  const config = CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.crud;

  return (
    <div className="modal-overlay" style={{ zIndex: 999 }}>
      <div className="modal-content" style={{ maxWidth: "460px", textAlign: "center", position: "relative" }}>
        <div className="bottom-sheet-handle" />

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
              top: "1.2rem",
              right: "1.2rem",
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "0.4rem",
            }}
            title="Cancel Operation"
          >
            <X size={18} />
          </button>
        )}

        {/* Animated Icon Ring */}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "20px",
            background: config.bgGlow,
            border: `1.5px solid ${config.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: config.color,
            margin: "0 auto 1rem auto",
            boxShadow: `0 0 24px ${config.bgGlow}`,
          }}
        >
          {config.icon}
        </div>

        {/* Category Badge */}
        <span
          className="badge"
          style={{
            background: config.bgGlow,
            color: config.color,
            border: `1px solid ${config.color}`,
            marginBottom: "0.75rem",
            fontSize: "0.68rem",
          }}
        >
          {config.badgeText}
        </span>

        {/* Title & Message */}
        <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
          {title || "Processing Bank Request..."}
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.45, marginBottom: steps.length > 0 ? "1.25rem" : "0.5rem" }}>
          {message || "Please wait while the cryptographic ledger completes your request."}
        </p>

        {/* Multi-Step Checklist */}
        {steps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", textAlign: "left", marginBottom: "0.5rem" }}>
            {steps.map((step, idx) => {
              const isCompleted = step.status === "completed" || idx < currentStepIndex;
              const isCurrent = step.status === "active" || idx === currentStepIndex;
              return (
                <div
                  key={idx}
                  style={{
                    background: isCurrent ? "var(--bg-elevated)" : "var(--bg-surface)",
                    border: `1px solid ${isCurrent ? config.color : "var(--border-subtle)"}`,
                    borderRadius: "12px",
                    padding: "0.65rem 0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    fontSize: "0.82rem",
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={16} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
                  ) : isCurrent ? (
                    <div
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        border: `2px solid ${config.color}`,
                        borderTopColor: "transparent",
                        animation: "spin 1s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <Clock size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  )}
                  <span style={{ color: isCurrent ? "var(--text-primary)" : isCompleted ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: isCurrent ? 700 : 500 }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalLoadingOverlay;
