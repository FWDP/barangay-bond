import React from "react";
import { ArrowRight, ArrowLeft, Calendar, Phone, MapPin } from "lucide-react";

interface DetailsStepProps {
  firstName: string;
  setFirstName: (val: string) => void;
  middleName: string;
  setMiddleName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  suffix: string;
  setSuffix: (val: string) => void;
  birthdate: string;
  setBirthdate: (val: string) => void;
  mobileNumber: string;
  setMobileNumber: (val: string) => void;
  address: string;
  setAddress: (val: string) => void;
  desiredRole: string;
  approvedBarangays: any[];
  selectedBarangayId: string;
  resMunicipality: string;
  resProvince: string;
  adminReqBarangayName: string;
  adminReqMunicipality: string;
  adminReqProvince: string;
  onPrev: () => void;
  onNext: () => void;
}

export const DetailsStep: React.FC<DetailsStepProps> = ({
  firstName,
  setFirstName,
  middleName,
  setMiddleName,
  lastName,
  setLastName,
  suffix,
  setSuffix,
  birthdate,
  setBirthdate,
  mobileNumber,
  setMobileNumber,
  address,
  setAddress,
  desiredRole,
  approvedBarangays,
  selectedBarangayId,
  resMunicipality,
  resProvince,
  adminReqBarangayName,
  adminReqMunicipality,
  adminReqProvince,
  onPrev,
  onNext
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      {/* Name Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.85rem" }}>
        <div className="form-group">
          <label>First Name</label>
          <input
            type="text"
            className="form-control"
            placeholder="Juan"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Middle Name</label>
          <input
            type="text"
            className="form-control"
            placeholder="Santos (Opt)"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.85rem" }}>
        <div className="form-group">
          <label>Last Name</label>
          <input
            type="text"
            className="form-control"
            placeholder="Dela Cruz"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Suffix</label>
          <input
            type="text"
            className="form-control"
            placeholder="Jr., III (Opt)"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
          />
        </div>
      </div>

      {/* Birthdate */}
      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Calendar size={14} style={{ color: "var(--role-accent)" }} /> Birthdate
        </label>
        <input
          type="date"
          className="form-control"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          required
        />
      </div>

      {/* Mobile Number */}
      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Phone size={14} style={{ color: "var(--role-accent)" }} /> Mobile Phone Number
        </label>
        <input
          type="tel"
          inputMode="tel"
          className="form-control"
          placeholder="09171234567"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          required
        />
      </div>

      {/* Address */}
      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <MapPin size={14} style={{ color: "var(--role-accent)" }} /> House # / Street Address
        </label>
        <input
          type="text"
          className="form-control"
          placeholder="House #12, Mabini Street, Phase 2"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "0.6rem 0.85rem", fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          {desiredRole === "resident" ? (() => {
            const selectedBgy = approvedBarangays.find((b) => b.id === selectedBarangayId);
            const bgyName = selectedBgy ? (selectedBgy.name || selectedBgy.barangayName) : "";
            const muniName = selectedBgy ? (selectedBgy.municipality || selectedBgy.municipalityName || resMunicipality) : resMunicipality;
            const provName = selectedBgy ? (selectedBgy.province || selectedBgy.provinceName || resProvince) : resProvince;
            return (
              <>📍 Attached Jurisdiction: <strong>{bgyName || "Barangay"}, {muniName || "Municipality"}, {provName || "Province"}</strong></>
            );
          })() : (
            <>📍 Attached Jurisdiction: <strong>{adminReqBarangayName || "Barangay"}, {adminReqMunicipality || "Municipality"}, {adminReqProvince || "Province"}</strong></>
          )}
        </div>
      </div>

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

export default DetailsStep;
