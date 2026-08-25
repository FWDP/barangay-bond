import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { WalletSelector } from "./WalletSelector";
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  User,
  Settings,
  FilePlus,
  ArrowRight
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
  onOpenWorkspace?: (workspaceKey: "projects" | "admin") => void;
}

export const ProfileSettingsPanel: React.FC<ProfileSettingsPanelProps> = ({
  profile,
  xlmBalance,
  onRequestResubmission,
  onOpenWorkspace
}) => {
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

  const userRole = profile?.role;
  const isSK = userRole === "sk_official";
  const isAdmin = userRole === "barangay_admin" || userRole === "system_admin";

  return (
    <div className="bank-section page-enter" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* 1. ROLE-GATED WORKSPACE BANNER (FOR SK OFFICIALS & ADMINS) */}
      {(isSK || isAdmin) && (
        <div
          className="section-card"
          style={{
            background: "var(--role-card-gradient)",
            border: "1px solid var(--role-accent-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            padding: "1.25rem 1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "var(--role-accent-soft)",
                color: "var(--role-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isSK ? <FilePlus size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "var(--text-primary)" }}>
                  {isSK ? "SK Project & Milestone Studio" : "Barangay Operations & Admin Desk"}
                </h3>
                <span className="badge badge-role" style={{ fontSize: "0.68rem" }}>
                  {isSK ? "Official Workspace" : "Admin Desk"}
                </span>
              </div>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                {isSK
                  ? "Draft youth proposals, run Gemini AI feasibility checks, and upload milestone deliverable proofs."
                  : "Review resident KYC applications, authorize smart contract escrows, and inspect municipal audit logs."}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary tap-scale"
            onClick={() => onOpenWorkspace?.(isSK ? "projects" : "admin")}
            style={{
              height: "42px",
              padding: "0 1.25rem",
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              flexShrink: 0,
            }}
          >
            <span>{isSK ? "Open SK Studio" : "Open Admin Desk"}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* 2. KYC RESUBMISSION ADVISORY IF REQUIRED */}
      {(isResubmissionRequired || isHardRejected) && (
        <div className="section-card" style={{ border: `1px solid ${isResubmissionRequired ? "rgba(245, 158, 11, 0.35)" : "rgba(239, 68, 68, 0.35)"}`, background: isResubmissionRequired ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: isResubmissionRequired ? "#fbbf24" : "#f87171", fontSize: "1.15rem", fontWeight: 800, margin: "0 0 0.4rem 0" }}>
            <AlertTriangle size={22} /> {isResubmissionRequired ? "Verification Resubmission Required" : "Verification Rejected"}
          </h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.5, fontSize: "0.86rem" }}>
            {isResubmissionRequired
              ? "Your account remains active, but flagged identity fields must be updated before full voting activation."
              : "Your account verification was rejected. Please review feedback or submit a fresh set of documents."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm tap-scale"
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
                className="btn btn-outline btn-sm tap-scale"
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

      {/* 3. 3-COLUMN BENTO GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
        {/* Card 1: Resident Identity */}
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <User size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>Profile Identity</h3>
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Citizen identity & verification</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.85rem" }}>
            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Full Name</span>
              <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.95rem" }}>{profile?.name || "N/A"}</div>
            </div>

            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Email Address</span>
              <div style={{ color: "var(--text-secondary)" }}>{profile?.email || user?.email}</div>
            </div>

            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Barangay Location</span>
              <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{profile?.barangayName ? `Brgy. ${profile.barangayName}` : "Unassigned"}</div>
            </div>

            <div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Account Status</span>
              <div>
                <span className={`badge badge-${profile?.verified ? "success" : "warning"}`} style={{ fontSize: "0.72rem" }}>
                  {profile?.verified ? "✓ Verified Resident" : "Review Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Stellar Ledger Integration */}
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <Activity size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>Stellar Wallet & Keys</h3>
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Connected wallet address</span>
            </div>
          </div>

          <WalletSelector balance={xlmBalance} />

          {profile?.walletAddress && (
            <div style={{ background: "var(--role-accent-soft)", border: "1px solid var(--role-accent-border)", borderRadius: "14px", padding: "0.9rem", fontSize: "0.8rem" }}>
              <div style={{ fontWeight: 800, color: "var(--role-badge-color)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <ShieldCheck size={15} /> Wallet Connected & Verified
              </div>
              <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.4, fontSize: "0.76rem" }}>
                Only one wallet is allowed per verified resident to ensure fair and authentic community voting.
              </p>
            </div>
          )}
        </div>

        {/* Card 3: Developer & Diagnostics */}
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c084fc" }}>
              <Settings size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>System Diagnostics</h3>
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Developer controls</span>
            </div>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>
            Enable live blockchain event logging and open the developer diagnostic terminal.
          </p>

          <button
            type="button"
            className={`btn btn-sm ${DEBUG_MODE ? "btn-outline-danger" : "btn-primary"} tap-scale`}
            style={{ height: "38px", marginTop: "auto" }}
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
