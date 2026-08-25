import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

interface ErrorValidationModalProps {
  isOpen: boolean;
  error: any;
  onClose: () => void;
  actionText?: string;
  onAction?: () => void;
}

export function getFriendlyErrorMessage(error: any): { title: string; message: string; detail?: string } {
  if (!error) {
    return {
      title: "Unknown Error",
      message: "An unexpected error occurred. Please try again."
    };
  }

  const rawMessage = typeof error === "string" ? error : error.message || String(error);
  const code = error.code || "";

  if (code === "auth/email-already-in-use" || rawMessage.includes("email-already-in-use")) {
    return {
      title: "Email Already Registered",
      message: "This email address is already linked to an existing account. Please sign in instead or use a different email address.",
      detail: code || "auth/email-already-in-use"
    };
  }

  if (code === "auth/weak-password" || rawMessage.includes("weak-password")) {
    return {
      title: "Password Too Weak",
      message: "Your password is too weak. For security, please enter a password that is at least 6 characters long and contains both letters and numbers.",
      detail: code || "auth/weak-password"
    };
  }

  if (code === "auth/invalid-email" || rawMessage.includes("invalid-email")) {
    return {
      title: "Invalid Email Address",
      message: "The email address you entered is formatted incorrectly. Please double-check the email format (e.g. resident@example.com).",
      detail: code || "auth/invalid-email"
    };
  }

  if (code === "auth/user-not-found" || rawMessage.includes("user-not-found")) {
    return {
      title: "Account Not Found",
      message: "No account matches this email address. Please make sure you spelled it correctly or sign up for a new profile.",
      detail: code || "auth/user-not-found"
    };
  }

  if (code === "auth/wrong-password" || rawMessage.includes("wrong-password")) {
    return {
      title: "Incorrect Password",
      message: "The password you entered is incorrect. If you forgot your password, please click the 'Forgot Password' link to reset it.",
      detail: code || "auth/wrong-password"
    };
  }

  if (code === "auth/too-many-requests" || rawMessage.includes("too-many-requests")) {
    return {
      title: "Account Temporarily Locked",
      message: "We detected too many failed login attempts. To protect your identity, access has been temporarily blocked. Please try again in 5 minutes.",
      detail: code || "auth/too-many-requests"
    };
  }

  if (code === "auth/network-request-failed" || rawMessage.includes("network-request-failed")) {
    return {
      title: "Network Connection Timeout",
      message: "Could not establish a secure connection to the authentication servers. Please verify your internet connection and try again.",
      detail: code || "auth/network-request-failed"
    };
  }

  if (code === "auth/inactive" || rawMessage.includes("Your account is inactive.")) {
    return {
      title: "Account Inactive",
      message: rawMessage,
      detail: code || "auth/inactive"
    };
  }

  if (code === "auth/suspended" || rawMessage.includes("Your account has been suspended")) {
    return {
      title: "Account Suspended",
      message: rawMessage,
      detail: code || "auth/suspended"
    };
  }

  if (rawMessage === "AI_SCORE_BELOW_THRESHOLD" || rawMessage.includes("AI_SCORE_BELOW_THRESHOLD")) {
    return {
      title: "Automated Verification Rejected",
      message: "Your uploaded identification documents did not pass our automated security threshold check. Please ensure you upload clear, readable images of valid, unexpired government IDs.",
      detail: "AI_SCORE_BELOW_THRESHOLD"
    };
  }

  if (rawMessage.includes("missing") || rawMessage.includes("required")) {
    return {
      title: "Required Fields Missing",
      message: rawMessage,
      detail: "MISSING_REQUIRED_FIELDS"
    };
  }

  return {
    title: "Request Interrupted",
    message: rawMessage.length > 250 ? rawMessage.slice(0, 250) + "..." : rawMessage,
    detail: code || "SYSTEM_EXCEPTION"
  };
}

export const ErrorValidationModal: React.FC<ErrorValidationModalProps> = ({
  isOpen,
  error,
  onClose,
  actionText,
  onAction
}) => {
  const [showTechnical, setShowTechnical] = useState(false);

  if (!isOpen || !error) return null;

  const { title, message, detail } = getFriendlyErrorMessage(error);
  const rawTechnical = typeof error === "string" ? error : JSON.stringify(error, null, 2);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
        <div className="bottom-sheet-handle" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "var(--accent-danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
              <AlertCircle size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>{title}</h3>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}>
          {message}
        </p>

        {/* Technical Diagnostics Collapsible */}
        <div style={{ border: "1px solid var(--border-primary)", borderRadius: "14px", overflow: "hidden", marginBottom: "1.25rem" }}>
          <button
            type="button"
            onClick={() => setShowTechnical(!showTechnical)}
            style={{
              width: "100%",
              padding: "0.6rem 0.85rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-elevated)",
              border: "none",
              cursor: "pointer",
              fontSize: "0.76rem",
              color: "var(--text-muted)",
              fontWeight: 700,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <AlertTriangle size={14} style={{ color: "#f59e0b" }} />
              DIAGNOSTICS: {detail || "ERROR"}
            </span>
            {showTechnical ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {showTechnical && (
            <pre style={{
              margin: 0,
              padding: "0.75rem",
              background: "#07090e",
              color: "var(--accent-blue)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono)",
              overflowX: "auto",
              maxHeight: "140px",
            }}>
              {rawTechnical}
            </pre>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          {actionText && onAction && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                onAction();
                onClose();
              }}
              style={{ flex: 1, height: "46px" }}
            >
              {actionText}
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger"
            onClick={onClose}
            style={{
              flex: 2,
              height: "46px",
            }}
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ErrorValidationModal;
