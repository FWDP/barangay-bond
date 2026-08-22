import React from "react";
import { compressImage } from "../../utils/imageCompressor";
import { Camera, UploadCloud, ArrowRight, ArrowLeft } from "lucide-react";

interface UploadsStepProps {
  idType: string;
  setIdType: (val: string) => void;
  idNumber: string;
  setIdNumber: (val: string) => void;
  profilePhoto: string;
  setProfilePhoto: (val: string) => void;
  idPhoto: string;
  setIdPhoto: (val: string) => void;
  selfiePhoto: string;
  setSelfiePhoto: (val: string) => void;
  desiredRole: string;
  compressing: boolean;
  setCompressing: (val: boolean) => void;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export const UploadsStep: React.FC<UploadsStepProps> = ({
  idType,
  setIdType,
  idNumber,
  setIdNumber,
  profilePhoto,
  setProfilePhoto,
  idPhoto,
  setIdPhoto,
  selfiePhoto,
  setSelfiePhoto,
  desiredRole,
  compressing,
  setCompressing,
  loading,
  onPrev,
  onNext
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <div className="form-group">
        <label>Identity Document Type</label>
        <select
          className="select-control"
          value={idType}
          onChange={(e) => setIdType(e.target.value)}
          required
        >
          <option value="barangay">Barangay ID (Preferred)</option>
          <option value="student">Student ID</option>
          <option value="national">National ID (PhilSys)</option>
          <option value="passport">Passport</option>
          <option value="driver">Driver's License</option>
          <option value="other">Other government ID</option>
        </select>
      </div>

      <div className="form-group">
        <label>Document ID Number</label>
        <input
          type="text"
          className="form-control"
          placeholder="e.g. BGY-2026-98472"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          required
        />
      </div>

      {/* Profile Avatar Upload */}
      <div className="form-group">
        <label style={{ fontWeight: 700 }}>1. Profile Photo / Avatar</label>
        <label
          className="dropzone-marching"
          style={{
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            cursor: "pointer",
            minHeight: "56px",
          }}
        >
          <input
            type="file"
            accept="image/*"
            capture="user"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setCompressing(true);
                const reader = new FileReader();
                reader.onloadend = async () => {
                  const compressed = await compressImage(reader.result as string);
                  setProfilePhoto(compressed);
                  setCompressing(false);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" style={{ width: "48px", height: "48px", borderRadius: "14px", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <Camera size={20} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: profilePhoto ? "var(--accent-green)" : "var(--text-primary)" }}>
              {profilePhoto ? "✓ Profile Photo Attached" : "Tap to capture or upload portrait"}
            </span>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Clear face portrait for identity audit</div>
          </div>
        </label>
      </div>

      {/* ID Document Photo Upload */}
      <div className="form-group">
        <label style={{ fontWeight: 700 }}>2. Government / Student ID Card</label>
        <label
          className="dropzone-marching"
          style={{
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            cursor: "pointer",
            minHeight: "56px",
          }}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setCompressing(true);
                const reader = new FileReader();
                reader.onloadend = async () => {
                  const compressed = await compressImage(reader.result as string);
                  setIdPhoto(compressed);
                  setCompressing(false);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          {idPhoto ? (
            <img src={idPhoto} alt="ID Document" style={{ width: "64px", height: "44px", borderRadius: "10px", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <UploadCloud size={20} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: idPhoto ? "var(--accent-green)" : "var(--text-primary)" }}>
              {idPhoto ? "✓ ID Document Scanned" : "Tap to snap or upload ID Card"}
            </span>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Front scan with visible name and birthdate</div>
          </div>
        </label>
      </div>

      {/* Selfie Photo Upload (Barangay Admin Only) */}
      {desiredRole === "barangay_admin" && (
        <div className="form-group">
          <label style={{ fontWeight: 700 }}>3. Selfie Holding ID Card (Admin Audit)</label>
          <label
            className="dropzone-marching"
            style={{
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              cursor: "pointer",
              minHeight: "56px",
            }}
          >
            <input
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCompressing(true);
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const compressed = await compressImage(reader.result as string);
                    setSelfiePhoto(compressed);
                    setCompressing(false);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            {selfiePhoto && selfiePhoto !== "N/A" ? (
              <img src={selfiePhoto} alt="Selfie" style={{ width: "48px", height: "48px", borderRadius: "14px", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "var(--accent-green-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-green)" }}>
                <Camera size={20} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: (selfiePhoto && selfiePhoto !== "N/A") ? "var(--accent-green)" : "var(--text-primary)" }}>
                {(selfiePhoto && selfiePhoto !== "N/A") ? "✓ Selfie Attached" : "Tap to capture selfie holding ID"}
              </span>
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Required for admin authorization</div>
            </div>
          </label>
        </div>
      )}

      {compressing && (
        <div style={{ color: "var(--role-accent)", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center", background: "var(--role-accent-soft)", padding: "0.5rem", borderRadius: "12px" }}>
          ⏳ Optimizing photo size for blockchain verification...
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button type="button" className="btn btn-outline btn-lg" onClick={onPrev} disabled={loading || compressing}>
          <ArrowLeft size={18} /> Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={onNext} disabled={loading || compressing}>
          {loading ? "Submitting Audit..." : <>Complete & Submit <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
};

export default UploadsStep;
