import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { WalletSelector } from "./WalletSelector";
import {
  AlertTriangle, ShieldCheck, Activity, User, Settings
} from "lucide-react";
import { DEBUG_MODE, setDebugMode } from "../config/debug";

import {
  getResubmissionFieldsForPreset,
  inferResubmissionPreset,
  inferResubmissionFields,
  type ResubmissionFieldKey,
} from "../utils/reviewDecision";

import { deriveLifecyclePhase } from "../utils/lifecycle";

interface ProfileSettingsPanelProps {
  profile: any;
  xlmBalance: string;
  onRequestResubmission: (context: any) => void;
}

export const ProfileSettingsPanel: React.FC<ProfileSettingsPanelProps> = ({ profile, xlmBalance, onRequestResubmission }) => {
  const { user } = useAuth();
  const phase = deriveLifecyclePhase(profile, user?.emailVerified);

  const isResubmissionRequired = phase === "RESUBMISSION_REQUIRED";
  const isDuplicateAutoReject = phase === "AUTO_REJECTED";
  const isHardRejected = phase === "REJECTED" || phase === "AUTO_REJECTED";

  const requiredFields: ResubmissionFieldKey[] = (profile?.resubmissionFields && profile.resubmissionFields.length > 0)
    ? profile.resubmissionFields
    : getResubmissionFieldsForPreset(
      profile?.resubmissionPreset || inferResubmissionPreset(profile?.resubmissionReason || profile?.autoRejectReason || profile?.verificationNotes || ""),
      inferResubmissionFields(profile?.resubmissionSuggestedReason || profile?.resubmissionReason || profile?.autoRejectReason || "", ["idPhotoUrl"])
    );

  const duplicateMessage = "Duplicate or authenticity concerns were identified. Please resubmit the full profile details and documents.";

  const openResubmissionWizard = (context: any) => {
    onRequestResubmission(context);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {(isResubmissionRequired || isHardRejected) && (
        <div className="glass-card" style={{ border: `1px solid ${isResubmissionRequired ? "rgba(245, 158, 11, 0.35)" : "rgba(239, 68, 68, 0.35)"}`, background: isResubmissionRequired ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: isResubmissionRequired ? "#fbbf24" : "#f87171", fontSize: "1.25rem", fontWeight: 800, margin: "0 0 0.4rem 0" }}>
            <AlertTriangle size={24} /> {isResubmissionRequired ? "Verification Resubmission Required" : "Verification Rejected"}
          </h2>
          <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5, fontSize: "0.9rem" }}>
            {isResubmissionRequired
              ? "Your account remains inside the dashboard, but flagged identity fields must be updated before full voting activation."
              : "Your account verification was rejected. Please review feedback or submit a fresh set of documents."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.25rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: "48px" }}
              onClick={() => openResubmissionWizard({
                mode: "resubmission",
                preset: "full_package",
                fields: getResubmissionFieldsForPreset("full_package"),
                reason: duplicateMessage,
                title: "Resubmit Full Profile",
                startStep: 3
              })}
            >
              Resubmit Full Profile
            </button>
            {!isDuplicateAutoReject && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ height: "48px" }}
                onClick={() => openResubmissionWizard({
                  mode: "resubmission",
                  preset: "custom",
                  fields: requiredFields,
                  reason: "Update only the flagged fields below.",
                  title: "Resubmit Flagged Fields",
                  startStep: requiredFields.some((field) => ["idPhotoUrl", "selfiePhotoUrl", "profilePhotoUrl"].includes(field)) ? 6 : 4
                })}
              >
                Resubmit Specific Fields
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3-Column Bento Grid on Desktop / Stacked on Mobile */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* Card 1: Resident Identity */}
        <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "14px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <User size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>Profile Identity</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Civil identification & civic records</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.88rem" }}>
            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Full Name</span>
              <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.98rem" }}>{profile?.name || "N/A"}</div>
            </div>

            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Email Address</span>
              <div style={{ color: "var(--text-secondary)" }}>{profile?.email || user?.email}</div>
            </div>

            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Jurisdiction</span>
              <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{profile?.barangayName ? `Brgy. ${profile.barangayName}` : "Unassigned"}</div>
            </div>

            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Role Status</span>
              <div>
                <span className={`badge badge-${profile?.verified ? "success" : "warning"}`} style={{ fontSize: "0.75rem" }}>
                  {profile?.verified ? "✓ Verified Resident" : "Review Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Stellar Ledger Integration */}
        <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "14px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <Activity size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>Stellar Ledger</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>On-chain wallet binding</span>
            </div>
          </div>

          <WalletSelector balance={xlmBalance} />

          {profile?.walletAddress && (
            <div style={{ background: "var(--role-accent-soft)", border: "1px solid var(--role-accent-border)", borderRadius: "18px", padding: "1.1rem", fontSize: "0.84rem" }}>
              <div style={{ fontWeight: 800, color: "var(--role-badge-color)", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <ShieldCheck size={16} /> Wallet Bound & Locked
              </div>
              <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                One wallet per verified resident to preserve Sybil resistance on Stellar Testnet.
              </p>
            </div>
          )}
        </div>

        {/* Card 3: Developer & Diagnostics */}
        <div className="bank-card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "14px", background: "rgba(168, 85, 247, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c084fc" }}>
              <Settings size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>Diagnostics Suite</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Developer observability controls</span>
            </div>
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            Toggle live Soroban RPC logging and display the floating diagnostic terminal console.
          </p>

          <button
            type="button"
            className={`btn ${DEBUG_MODE ? "btn-outline-danger" : "btn-primary"}`}
            style={{ height: "48px" }}
            onClick={() => {
              setDebugMode(!DEBUG_MODE);
            }}
          >
            {DEBUG_MODE ? "Disable Debug Mode" : "Enable Debug Mode & Console"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsPanel;
