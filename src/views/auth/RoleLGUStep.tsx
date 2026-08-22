import React from "react";
import { UserCheck, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

interface RoleLGUStepProps {
  desiredRole: "resident" | "barangay_admin" | "system_admin";
  setDesiredRole: (val: "resident" | "barangay_admin") => void;
  loadingBarangays: boolean;
  approvedBarangays: any[];
  resRegion: string;
  setResRegion: (val: string) => void;
  resProvince: string;
  setResProvince: (val: string) => void;
  resMunicipality: string;
  setResMunicipality: (val: string) => void;
  selectedBarangayId: string;
  setSelectedBarangayId: (val: string) => void;
  psgcLoading: boolean;
  psgcRegions: Array<{ code: string; name: string }>;
  selectedPsgcRegionCode: string;
  setSelectedPsgcRegionCode: (val: string) => void;
  psgcProvinces: Array<{ code: string; name: string }>;
  selectedPsgcProvinceCode: string;
  setSelectedPsgcProvinceCode: (val: string) => void;
  psgcMunicipalities: Array<{ code: string; name: string }>;
  selectedPsgcMunicipalityCode: string;
  setSelectedPsgcMunicipalityCode: (val: string) => void;
  psgcBarangays: Array<{ code: string; name: string }>;
  adminReqBarangayName: string;
  setAdminReqBarangayName: (val: string) => void;
  isRegistrationDisabled: boolean;
  user: any;
  signOut: () => Promise<void>;
  setViewState: (state: any) => void;
  onNext: () => void;
}

export const RoleLGUStep: React.FC<RoleLGUStepProps> = ({
  desiredRole,
  setDesiredRole,
  loadingBarangays,
  approvedBarangays,
  resRegion,
  setResRegion,
  resProvince,
  setResProvince,
  resMunicipality,
  setResMunicipality,
  selectedBarangayId,
  setSelectedBarangayId,
  psgcLoading,
  psgcRegions,
  selectedPsgcRegionCode,
  setSelectedPsgcRegionCode,
  psgcProvinces,
  selectedPsgcProvinceCode,
  setSelectedPsgcProvinceCode,
  psgcMunicipalities,
  selectedPsgcMunicipalityCode,
  setSelectedPsgcMunicipalityCode,
  psgcBarangays,
  adminReqBarangayName,
  setAdminReqBarangayName,
  isRegistrationDisabled,
  user,
  signOut,
  setViewState,
  onNext
}) => {
  const matchStr = (a?: string, b?: string) => {
    if (!a || !b) return false;
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* 2 Interactive Role Cards */}
      <div className="form-group">
        <label>Choose Your Role</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
          {/* Card 1: Resident */}
          <div
            onClick={() => setDesiredRole("resident")}
            style={{
              padding: "1.25rem 1rem",
              borderRadius: "20px",
              cursor: "pointer",
              border: desiredRole === "resident" ? "2px solid var(--role-accent)" : "1px solid var(--border-primary)",
              background: desiredRole === "resident" ? "var(--role-accent-soft)" : "var(--bg-elevated)",
              boxShadow: desiredRole === "resident" ? "0 8px 20px -4px var(--role-accent-soft)" : "none",
              transform: desiredRole === "resident" ? "scale(1.02)" : "scale(1)",
              transition: "all 0.2s ease",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "0.4rem",
            }}
          >
            {desiredRole === "resident" && (
              <div style={{ position: "absolute", top: "10px", right: "10px", color: "var(--role-accent)" }}>
                <CheckCircle2 size={18} />
              </div>
            )}
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
              <UserCheck size={22} />
            </div>
            <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>Youth Resident</strong>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Audit & Vote on Milestones</span>
          </div>

          {/* Card 2: Barangay Admin */}
          <div
            onClick={() => setDesiredRole("barangay_admin")}
            style={{
              padding: "1.25rem 1rem",
              borderRadius: "20px",
              cursor: "pointer",
              border: desiredRole === "barangay_admin" ? "2px solid var(--accent-blue)" : "1px solid var(--border-primary)",
              background: desiredRole === "barangay_admin" ? "var(--accent-blue-soft)" : "var(--bg-elevated)",
              boxShadow: desiredRole === "barangay_admin" ? "0 8px 20px -4px var(--accent-blue-soft)" : "none",
              transform: desiredRole === "barangay_admin" ? "scale(1.02)" : "scale(1)",
              transition: "all 0.2s ease",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "0.4rem",
            }}
          >
            {desiredRole === "barangay_admin" && (
              <div style={{ position: "absolute", top: "10px", right: "10px", color: "var(--accent-blue)" }}>
                <CheckCircle2 size={18} />
              </div>
            )}
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--accent-blue-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-blue)" }}>
              <ShieldCheck size={22} />
            </div>
            <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>Barangay Admin</strong>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Deploy Escrows & Verify</span>
          </div>
        </div>
      </div>

      {desiredRole === "resident" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {loadingBarangays ? (
            <div style={{ padding: "0.5rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              ⏳ Fetching active Barangay Bond communities...
            </div>
          ) : approvedBarangays.length === 0 ? (
            <div className="form-error-msg" style={{ fontSize: "0.85rem", padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "14px" }}>
              ⚠️ Barangay Bond is not yet available in your barangay. Please contact your Barangay Office or System Administrator.
            </div>
          ) : (() => {
            const availableRegions = Array.from(new Set(approvedBarangays.map((b) => b.regionName || "REGION IV-A (CALABARZON)").filter(Boolean)));
            const activeRegion = availableRegions.find((r) => matchStr(r, resRegion)) || resRegion || availableRegions[0] || "";

            const availableProvinces = Array.from(new Set(approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", activeRegion)).map((b) => b.province || b.provinceName).filter(Boolean)));
            const activeProvince = availableProvinces.find((p) => matchStr(p, resProvince)) || availableProvinces[0] || "";

            const availableMunicipalities = Array.from(new Set(approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", activeRegion) && matchStr(b.province || b.provinceName, activeProvince)).map((b) => b.municipality || b.municipalityName).filter(Boolean)));
            const activeMunicipality = availableMunicipalities.find((m) => matchStr(m, resMunicipality)) || availableMunicipalities[0] || "";

            const matchingBarangays = approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", activeRegion) && matchStr(b.province || b.provinceName, activeProvince) && matchStr(b.municipality || b.municipalityName, activeMunicipality));

            return (
              <>
                <div className="form-group">
                  <label>Region</label>
                  <select
                    className="select-control"
                    value={activeRegion}
                    onChange={(e) => {
                      setResRegion(e.target.value);
                      const newProvs = Array.from(new Set(approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", e.target.value)).map((b) => b.province || b.provinceName).filter(Boolean)));
                      if (newProvs.length > 0) {
                        setResProvince(newProvs[0]);
                        const newMunis = Array.from(new Set(approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", e.target.value) && matchStr(b.province || b.provinceName, newProvs[0])).map((b) => b.municipality || b.municipalityName).filter(Boolean)));
                        if (newMunis.length > 0) {
                          setResMunicipality(newMunis[0]);
                          const newBgys = approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", e.target.value) && matchStr(b.province || b.provinceName, newProvs[0]) && matchStr(b.municipality || b.municipalityName, newMunis[0]));
                          if (newBgys.length > 0) setSelectedBarangayId(newBgys[0].id);
                        }
                      }
                    }}
                    required
                  >
                    {availableRegions.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Province</label>
                  <select
                    className="select-control"
                    value={activeProvince}
                    onChange={(e) => {
                      setResProvince(e.target.value);
                      const newMunis = Array.from(new Set(approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", activeRegion) && matchStr(b.province || b.provinceName, e.target.value)).map((b) => b.municipality || b.municipalityName).filter(Boolean)));
                      if (newMunis.length > 0) {
                        setResMunicipality(newMunis[0]);
                        const newBgys = approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", activeRegion) && matchStr(b.province || b.provinceName, e.target.value) && matchStr(b.municipality || b.municipalityName, newMunis[0]));
                        if (newBgys.length > 0) setSelectedBarangayId(newBgys[0].id);
                      }
                    }}
                    required
                  >
                    {availableProvinces.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Municipality / City</label>
                  <select
                    className="select-control"
                    value={activeMunicipality}
                    onChange={(e) => {
                      setResMunicipality(e.target.value);
                      const newBgys = approvedBarangays.filter((b) => matchStr(b.regionName || "REGION IV-A (CALABARZON)", activeRegion) && matchStr(b.province || b.provinceName, activeProvince) && matchStr(b.municipality || b.municipalityName, e.target.value));
                      if (newBgys.length > 0) setSelectedBarangayId(newBgys[0].id);
                    }}
                    required
                  >
                    {availableMunicipalities.map((muni) => (
                      <option key={muni} value={muni}>
                        {muni}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Barangay Community</label>
                  {matchingBarangays.length === 0 ? (
                    <div className="form-error-msg" style={{ fontSize: "0.85rem", padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "14px" }}>
                      ⚠️ Barangay Bond is not yet available in your selected municipality.
                    </div>
                  ) : (
                    <select
                      className="select-control"
                      value={selectedBarangayId || matchingBarangays[0].id}
                      onChange={(e) => setSelectedBarangayId(e.target.value)}
                      required
                    >
                      {matchingBarangays.map((b) => (
                        <option key={b.id} value={b.id}>
                          ✓ {b.name || b.barangayName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {desiredRole === "barangay_admin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {psgcLoading && (
            <div style={{ fontSize: "0.85rem", color: "#0284c7", fontStyle: "italic", padding: "0.5rem 0.75rem", background: "rgba(2, 132, 199, 0.08)", borderRadius: "12px" }}>
              🔄 Loading official PSGC geographic data...
            </div>
          )}

          <div className="form-group">
            <label>Region</label>
            <select
              className="select-control"
              value={selectedPsgcRegionCode}
              onChange={(e) => setSelectedPsgcRegionCode(e.target.value)}
              required
            >
              {psgcRegions.map((reg) => (
                <option key={reg.code} value={reg.code}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Province</label>
            <select
              className="select-control"
              value={selectedPsgcProvinceCode}
              onChange={(e) => setSelectedPsgcProvinceCode(e.target.value)}
              required
            >
              {psgcProvinces.map((prov) => (
                <option key={prov.code} value={prov.code}>
                  {prov.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Municipality / City</label>
            <select
              className="select-control"
              value={selectedPsgcMunicipalityCode}
              onChange={(e) => setSelectedPsgcMunicipalityCode(e.target.value)}
              required
            >
              {psgcMunicipalities.map((muni) => (
                <option key={muni.code} value={muni.code}>
                  {muni.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Barangay Name to Represent</label>
            <input
              type="text"
              className="form-control"
              list="psgc-barangay-suggestions"
              placeholder="Select or type your barangay name..."
              value={adminReqBarangayName}
              onChange={(e) => setAdminReqBarangayName(e.target.value)}
              required
            />
            <datalist id="psgc-barangay-suggestions">
              {psgcBarangays.map((bgy) => (
                <option key={bgy.code} value={bgy.name} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-lg w-100"
        style={{ marginTop: "0.5rem", width: "100%", height: "54px" }}
        disabled={isRegistrationDisabled}
        onClick={onNext}
      >
        Continue to Personal Details <ArrowRight size={18} />
      </button>

      {user && (
        <button
          type="button"
          className="btn btn-outline-danger w-100"
          onClick={async () => {
            await signOut();
            setViewState("landing");
          }}
        >
          Log Out
        </button>
      )}
    </div>
  );
};

export default RoleLGUStep;
