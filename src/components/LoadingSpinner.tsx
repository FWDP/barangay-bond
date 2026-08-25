import React from "react";
import { Shield, Sparkles } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "fullscreen" | "raw";
  label?: string | false;
  sublabel?: string;
  hideLabels?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  label = "Securing Session & Synchronizing...",
  sublabel,
  hideLabels = false,
}) => {
  if (size === "sm") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
        <div
          style={{
            width: "18px",
            height: "18px",
            border: "2.5px solid var(--border-subtle)",
            borderTopColor: "var(--role-accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        {!hideLabels && label && (
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
        )}
      </div>
    );
  }

  const isFullscreen = size === "fullscreen" || size === "lg";
  const shouldShowLabels = !hideLabels && label !== false && size !== "raw";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isFullscreen ? "2.5rem 1.5rem" : shouldShowLabels ? "1.5rem" : "0",
        minHeight: isFullscreen ? "320px" : "auto",
        width: "100%",
        textAlign: "center",
      }}
    >
      {/* Glowing Orbital Ring Container */}
      <div
        style={{
          position: "relative",
          width: isFullscreen ? "84px" : "56px",
          height: isFullscreen ? "84px" : "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: shouldShowLabels ? "1.25rem" : "0",
        }}
      >
        {/* Soft Ambient Glow Halo */}
        <div
          style={{
            position: "absolute",
            inset: "-8px",
            borderRadius: "50%",
            background: "radial-gradient(circle, var(--role-accent-soft) 0%, transparent 70%)",
            filter: "blur(8px)",
            opacity: 0.85,
            animation: "pulse-glow 2.5s ease-in-out infinite alternate",
          }}
        />

        {/* Outer Counter-Rotating Gradient Ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2.5px solid transparent",
            borderTopColor: "var(--role-accent)",
            borderRightColor: "var(--accent-green)",
            animation: "spin 1.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite reverse",
          }}
        />

        {/* Inner Fast Spinner Ring */}
        <div
          style={{
            position: "absolute",
            inset: "6px",
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "var(--role-badge-color)",
            borderLeftColor: "var(--role-accent)",
            animation: "spin 1s linear infinite",
          }}
        />

        {/* Center Shield Icon Emblem */}
        <div
          style={{
            width: isFullscreen ? "38px" : "26px",
            height: isFullscreen ? "38px" : "26px",
            borderRadius: "10px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--role-accent)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
            animation: "pulse-glow 2s ease-in-out infinite",
          }}
        >
          <Shield size={isFullscreen ? 18 : 13} />
        </div>
      </div>

      {/* Label and Badge (Only rendered when not hidden) */}
      {shouldShowLabels && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <h4
            style={{
              margin: 0,
              fontSize: isFullscreen ? "1.05rem" : "0.92rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span>{label}</span>
          </h4>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.74rem",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
              padding: "0.3rem 0.75rem",
              borderRadius: "999px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <Sparkles size={12} style={{ color: "var(--role-accent)" }} />
            <span>{sublabel || "Stellar Soroban Testnet Consensus Active"}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
