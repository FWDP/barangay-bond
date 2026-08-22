import React from "react";
import { GraduationCap, Briefcase, ArrowRight, ArrowLeft } from "lucide-react";

interface AddInfoStepProps {
  desiredRole: string;
  professionalInfo: string;
  setProfessionalInfo: (val: string) => void;
  adminReason: string;
  setAdminReason: (val: string) => void;
  schoolName: string;
  setSchoolName: (val: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const AddInfoStep: React.FC<AddInfoStepProps> = ({
  desiredRole,
  professionalInfo,
  setProfessionalInfo,
  adminReason,
  setAdminReason,
  schoolName,
  setSchoolName,
  onPrev,
  onNext
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {desiredRole === "barangay_admin" ? (
        <>
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Briefcase size={14} style={{ color: "var(--role-accent)" }} /> Barangay / SK Official Title
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Barangay Executive Secretary / SK Chairman"
              value={professionalInfo}
              onChange={(e) => setProfessionalInfo(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Reason for Barangay Admin Appointment</label>
            <textarea
              className="form-control"
              placeholder="Describe your role in verifying residents and managing public escrow budgets..."
              value={adminReason}
              onChange={(e) => setAdminReason(e.target.value)}
              rows={3}
              required
            />
          </div>
        </>
      ) : (
        <>
          <div style={{ background: "var(--role-accent-soft)", border: "1px solid var(--role-accent-border)", borderRadius: "18px", padding: "1rem", fontSize: "0.85rem" }}>
            <span style={{ fontWeight: 700, color: "var(--role-accent)", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
              <GraduationCap size={16} /> Student Verification Notice
            </span>
            <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.4" }}>
              If submitting a valid Student ID, enter your school/university name below. Otherwise, you can proceed directly.
            </p>
          </div>

          <div className="form-group">
            <label>School / University Name (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Pamantasan ng Lungsod / University"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button type="button" className="btn btn-outline btn-lg" onClick={onPrev}>
          <ArrowLeft size={18} /> Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={onNext}>
          Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default AddInfoStep;
