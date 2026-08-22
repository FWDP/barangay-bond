import React from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";

interface SuccessStepProps {
  desiredRole: string;
  resubmissionMode: boolean;
  setViewState: (state: any) => void;
  setSignUpStep: (val: number) => void;
  setEmail: (val: string) => void;
  setPassword: (val: string) => void;
  setFirstName: (val: string) => void;
  setMiddleName: (val: string) => void;
  setLastName: (val: string) => void;
  setSuffix: (val: string) => void;
  setBirthdate: (val: string) => void;
  setMobileNumber: (val: string) => void;
  setAddress: (val: string) => void;
  setIdNumber: (val: string) => void;
  setSchoolName: (val: string) => void;
  setIdPhoto: (val: string) => void;
  setSelfiePhoto: (val: string) => void;
  setProfilePhoto: (val: string) => void;
  setIsLogin: (val: boolean) => void;
}

export const SuccessStep: React.FC<SuccessStepProps> = ({
  desiredRole,
  resubmissionMode,
  setViewState,
  setSignUpStep,
  setEmail,
  setPassword,
  setFirstName,
  setMiddleName,
  setLastName,
  setSuffix,
  setBirthdate,
  setMobileNumber,
  setAddress,
  setIdNumber,
  setSchoolName,
  setIdPhoto,
  setSelfiePhoto,
  setProfilePhoto,
  setIsLogin
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1.25rem", padding: "1rem 0" }}>
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "9999px",
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 28px -4px rgba(16, 185, 129, 0.4)",
        }}
      >
        <ShieldCheck size={40} />
      </div>

      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.4rem 0", color: "var(--text-primary)" }}>
          Identity Verified & Submitted!
        </h2>
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0, maxWidth: "380px" }}>
          Your profile and visual documents have been recorded for on-chain identity verification.
        </p>
      </div>

      <div
        style={{
          background: "var(--bg-elevated)",
          borderRadius: "20px",
          padding: "1.1rem 1.25rem",
          width: "100%",
          textAlign: "left",
          fontSize: "0.82rem",
          border: "1px solid var(--border-primary)",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.4rem" }}>Next Steps:</span>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {desiredRole === "barangay_admin" ? (
            <li>The System Administrator will verify your credentials and representational request.</li>
          ) : (
            <li>Your Barangay Admin will verify your resident identity and activate your on-chain voting rights.</li>
          )}
          <li>You can browse all public treasury records in the meantime.</li>
        </ul>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg w-100"
        style={{ width: "100%", height: "54px" }}
        onClick={() => {
          if (resubmissionMode) {
            setViewState("dashboard");
          } else {
            setSignUpStep(1);
            setEmail("");
            setPassword("");
            setFirstName("");
            setMiddleName("");
            setLastName("");
            setSuffix("");
            setBirthdate("");
            setMobileNumber("");
            setAddress("");
            setIdNumber("");
            setSchoolName("");
            setIdPhoto("");
            setSelfiePhoto("N/A");
            setProfilePhoto("");
            setIsLogin(true);
          }
        }}
      >
        {resubmissionMode ? "Back to Dashboard" : "Proceed to Login"} <ArrowRight size={18} />
      </button>
    </div>
  );
};

export default SuccessStep;
