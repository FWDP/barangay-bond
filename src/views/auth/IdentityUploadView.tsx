import React, { useState } from "react";
import { compressImage } from "../../utils/imageCompressor";
import { Camera, UploadCloud, ShieldCheck, LogOut, ArrowRight } from "lucide-react";

interface IdentityUploadViewProps {
  profile: any;
  onUploadComplete: (idUrl: string, selfieUrl: string, avatarUrl: string) => void;
  onLogout: () => void;
}

export const IdentityUploadView: React.FC<IdentityUploadViewProps> = ({ profile, onUploadComplete, onLogout }) => {
  const [idPhoto, setIdPhoto] = useState("");
  const [selfiePhoto, setSelfiePhoto] = useState("N/A");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!idPhoto) {
      setError("Please upload your government ID.");
      return;
    }
    if (profile.requestedRole === "barangay_admin" && (!selfiePhoto || selfiePhoto === "N/A")) {
      setError("Please upload a selfie holding your ID card.");
      return;
    }
    if (!profilePhoto) {
      setError("Please upload your profile photo.");
      return;
    }
    onUploadComplete(idPhoto, selfiePhoto, profilePhoto);
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem", backgroundColor: "var(--bg-base)" }}>
      <div className="bank-card" style={{ maxWidth: "540px", width: "100%", padding: "2.5rem 2rem" }}>
        <div style={{ width: "60px", height: "60px", borderRadius: "9999px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto", color: "var(--role-accent)" }}>
          <ShieldCheck size={32} />
        </div>

        <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.4rem", textAlign: "center" }}>
          Complete Identity Verification
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.55, marginBottom: "1.75rem", textAlign: "center" }}>
          Your email has been verified. Now attach your ID document and photo to initiate AI-powered verification.
        </p>

        {error && (
          <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "16px", padding: "0.85rem 1rem", color: "var(--accent-danger)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            {error}
          </div>
        )}

        {compressing && (
          <div style={{ background: "var(--accent-blue-soft)", border: "1px solid var(--accent-blue)", borderRadius: "16px", padding: "0.75rem", color: "var(--accent-blue)", fontSize: "0.85rem", marginBottom: "1.25rem", textAlign: "center", fontWeight: 700 }}>
            ⏳ Optimizing image for AI audit...
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Avatar Dropzone */}
          <div className="form-group">
            <label style={{ fontWeight: 700 }}>1. Portrait Photo (Avatar)</label>
            <label className="dropzone-marching" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
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
                <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "var(--accent-blue-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-blue)" }}>
                  <Camera size={20} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: profilePhoto ? "var(--accent-green)" : "var(--text-primary)" }}>
                  {profilePhoto ? "✓ Portrait Photo Attached" : "Capture or select portrait photo"}
                </span>
              </div>
            </label>
          </div>

          {/* ID Card Dropzone */}
          <div className="form-group">
            <label style={{ fontWeight: 700 }}>2. Government ID Photo</label>
            <label className="dropzone-marching" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
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
                <img src={idPhoto} alt="ID" style={{ width: "48px", height: "48px", borderRadius: "14px", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "var(--accent-blue-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-blue)" }}>
                  <UploadCloud size={20} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: idPhoto ? "var(--accent-green)" : "var(--text-primary)" }}>
                  {idPhoto ? "✓ ID Document Attached" : "Capture or upload front of ID"}
                </span>
              </div>
            </label>
          </div>

          {/* Selfie with ID (Barangay Admin Only) */}
          {profile.requestedRole === "barangay_admin" && (
            <div className="form-group">
              <label style={{ fontWeight: 700 }}>3. Selfie Holding ID Card</label>
              <label className="dropzone-marching" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
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
                  <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "var(--accent-blue-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-blue)" }}>
                    <Camera size={20} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: selfiePhoto && selfiePhoto !== "N/A" ? "var(--accent-green)" : "var(--text-primary)" }}>
                    {selfiePhoto && selfiePhoto !== "N/A" ? "✓ Selfie Attached" : "Capture selfie holding your ID"}
                  </span>
                </div>
              </label>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg w-100"
            style={{ width: "100%", height: "52px", marginTop: "0.5rem" }}
            disabled={compressing}
          >
            Submit for AI Verification <ArrowRight size={18} />
          </button>

          <button
            type="button"
            className="btn btn-outline-danger w-100"
            onClick={onLogout}
            style={{ height: "46px" }}
          >
            <LogOut size={16} /> Log Out
          </button>
        </form>
      </div>
    </div>
  );
};

export default IdentityUploadView;
