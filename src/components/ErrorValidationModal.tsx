import React, { useState } from "react";
import { AlertCircle, AlertTriangle, X, ChevronDown, ChevronRight } from "lucide-react";

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

  // Firebase Auth Error Codes Mapping
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

  // Custom AI / Residency Validation Checks
  if (rawMessage === "AI_SCORE_BELOW_THRESHOLD" || rawMessage.includes("AI_SCORE_BELOW_THRESHOLD")) {
    return {
      title: "Automated Verification Rejected",
      message: "Your uploaded identification documents did not pass our automated security threshold check. Please ensure you upload clear, readable images of valid, unexpired government IDs.",
      detail: "AI_SCORE_BELOW_THRESHOLD"
    };
  }

  if (rawMessage.includes("Age validation failed") || rawMessage.includes("at least 15 years old")) {
    return {
      title: "Youth Age Constraint",
      message: "You must be at least 15 years old to register as a participating voting resident. Overaged residents (>30) register as permanent approved viewers.",
      detail: "AGE_LIMIT_MINIMUM"
    };
  }

  if (rawMessage.includes("Selected barangay is no longer active")) {
    return {
      title: "Inactive Barangay Location",
      message: "The selected Barangay is currently inactive or unapproved. Please contact your local LGU administrator to enable this jurisdiction.",
      detail: "BARANGAY_INACTIVE"
    };
  }

  if (rawMessage.includes("Cannot promote residents outside your assigned Barangay")) {
    return {
      title: "LGU Jurisdiction Access Denied",
      message: "You do not have administrative authority over this resident because they belong to a different Barangay jurisdiction.",
      detail: "JURISDICTION_MISMATCH"
    };
  }

  if (rawMessage.includes("already assigned as active SK")) {
    return {
      title: "Official Cabinet Slot Occupied",
      message: "An active official is already appointed to this council position. Please revoke the active term before promoting a new candidate.",
      detail: "SLOT_CONFLICT"
    };
  }

  if (rawMessage.includes("Stellar wallet address")) {
    return {
      title: "Unlinked Stellar Wallet",
      message: "This resident has not bound a public Stellar address. Verified residents must connect their wallet (e.g. Freighter) before being assigned SK roles.",
      detail: "WALLET_UNLINKED"
    };
  }

  if (rawMessage.includes("Cannot verify resident outside")) {
    return {
      title: "Jurisdiction Access Denied",
      message: "You are not authorized to verify this profile. Administrative updates are restricted to residents within your local boundary custody.",
      detail: "VERIFICATION_JURISDICTION_ERROR"
    };
  }

  // Fallback generic mapping
  return {
    title: "Action Verification Alert",
    message: rawMessage,
    detail: code || "UNKNOWN_ERROR_CODE"
  };
}

export const ErrorValidationModal: React.FC<ErrorValidationModalProps> = ({
  isOpen,
  error,
  onClose,
  actionText,
  onAction,
}) => {
  const [showTechnical, setShowTechnical] = useState(false);

  if (!isOpen || !error) return null;

  const { title, message, detail } = getFriendlyErrorMessage(error);
  const rawTechnical = typeof error === "string" ? error : JSON.stringify(error, null, 2);

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-card border-error" style={{ position: "relative", overflow: "hidden" }}>

        {/* Error Accent Banner */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)"
        }} />

        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={22} style={{ color: "#ef4444" }} />
            <h3 className="modal-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#94a3b8" }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "0.2rem 0" }}>
          <p className="modal-description" style={{ color: "#334155", fontSize: "0.95rem", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
            {message}
          </p>

          {/* Technical Diagnostics Collapsible */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", marginBottom: "1.5rem" }}>
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                color: "#64748b",
                fontWeight: 600
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <AlertTriangle size={12} style={{ color: "#f59e0b" }} />
                TECHNICAL SYSTEM CODE: {detail || "ERROR_DIAGNOSTICS"}
              </span>
              {showTechnical ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showTechnical && (
              <pre style={{
                margin: 0,
                padding: "0.75rem",
                background: "#0f172a",
                color: "#38bdf8",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                overflowX: "auto",
                maxHeight: "150px"
              }}>
                {rawTechnical}
              </pre>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", gap: "0.75rem", borderTop: "1px solid #f1f5f9", paddingTop: "1rem" }}>
          {actionText && onAction && (
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                onAction();
                onClose();
              }}
              style={{ flex: 1, padding: "0.6rem" }}
            >
              {actionText}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={onClose}
            style={{
              flex: 2,
              padding: "0.6rem",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              border: "none",
              boxShadow: "0 4px 6px -1px rgba(239, 68, 68, 0.2)"
            }}
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
};
