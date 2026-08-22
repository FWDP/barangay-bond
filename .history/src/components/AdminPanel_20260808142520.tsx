import React, { useState, useEffect } from "react";
import { verifyResident, verifySKOfficial } from "../transactions/transactions";
import { useAuth } from "../contexts/AuthContext";
import type { UserProfile } from "../contexts/AuthContext";
import type { TransactionStatus } from "../types";
import { db } from "../services/firebase";
import { collection, query, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import { getFuzzySimilarity } from "../services/gemini";
import {
  RESUBMISSION_FIELD_OPTIONS,
  RESUBMISSION_PRESETS,
  getResubmissionFieldLabel,
  getResubmissionFieldsForPreset,
  getResubmissionPresetDescription,
  getResubmissionPresetLabel,
  getResubmissionSuggestedReasonForPreset,
  inferResubmissionPreset,
  type ResubmissionFieldKey,
  type ResubmissionPresetKey,
} from "../utils/reviewDecision";
import {
  ShieldCheck, UserCheck, X, AlertCircle, Ban,
  UserX, CheckCircle2, History, Radio, RefreshCw,
  ZoomIn, ZoomOut, Maximize2, Eye, RotateCw
} from "lucide-react";
import { ErrorValidationModal } from "./ErrorValidationModal";

interface AdminPanelProps {
  adminAddress: string;
  onExecute: (
    actionFn: (
      onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
    ) => Promise<string>
  ) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ adminAddress, onExecute }) => {
  const {
    profile,
    dbUsers,
    verifyUserInDb,
    approveBarangayAdmin,
    suspendBarangayAdmin,
    assignSKOfficial,
    revokeSKOfficial,
    lockProfileForReview
    , adminOverrideApprove
  } = useAuth();

  // Dialog / Drawer states
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [aiVerification, setAiVerification] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedResubmissionPreset, setSelectedResubmissionPreset] = useState<ResubmissionPresetKey>("custom");
  const [selectedResubmissionFields, setSelectedResubmissionFields] = useState<ResubmissionFieldKey[]>([]);

  // Interactive Image Zoom Lightbox State
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomRotation, setZoomRotation] = useState<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoomImage(null);
        setZoomLevel(1);
        setZoomRotation(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Audit Logs and Barangay States
  const [logs, setLogs] = useState<any[]>([]);

  // Selected resident or official states

  const [selectedResidentForSK, setSelectedResidentForSK] = useState<UserProfile | null>(null);
  const [skPosition, setSkPosition] = useState<"chairman" | "kagawad" | "secretary" | "treasurer">("chairman");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [skError, setSkError] = useState("");
  const [panelError, setPanelError] = useState<any | null>(null);
  const [residentFilter, setResidentFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [logsFilterCategory, setLogsFilterCategory] = useState("");
  const [logsFilterSeverity, setLogsFilterSeverity] = useState("");

  // Fetch audit records and LGUs
  const loadLogsAndBarangays = async () => {
    try {
      const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const logList: any[] = [];
      snap.forEach((docSnap) => {
        logList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLogs(logList);
    } catch (err) {
      console.error("Failed to load LGU audit records:", err);
    }
  };

  useEffect(() => {
    loadLogsAndBarangays();
  }, [dbUsers]);

  const handleAssignAdmin = async () => {
    if (!selectedUser) return;
    const bgyId = selectedUser.requestedBarangayId || "042103011";
    const bgyName = selectedUser.requestedBarangayName || "Bucandala III";
    const muniName = selectedUser.requestedMunicipalityName || "Imus City";
    const provName = selectedUser.requestedProvinceName || "Cavite";
    const regName = selectedUser.requestedRegionName || "CALABARZON";

    try {
      await approveBarangayAdmin(
        selectedUser.uid,
        bgyId,
        bgyName,
        muniName,
        provName,
        regName,
        "4103"
      );
      alert(`Approved ${selectedUser.name} as admin for Barangay ${bgyName}.`);
      handleCloseReview();
    } catch (err: any) {
      setPanelError(err);
    }
  };

  const handleSuspendAdmin = async (uid: string, isSuspend: boolean) => {
    if (confirm(`Are you sure you want to ${isSuspend ? "SUSPEND" : "REACTIVATE"} this Barangay Admin?`)) {
      try {
        await suspendBarangayAdmin(uid, isSuspend);
        alert(`Admin status successfully changed to ${isSuspend ? "SUSPENDED" : "ACTIVE"}.`);
      } catch (err: any) {
        setPanelError(err);
      }
    }
  };

  const handlePromoteSK = async (e: React.FormEvent) => {
    e.preventDefault();
    setSkError("");
    if (!selectedResidentForSK || !termStart || !termEnd) return;

    if (!selectedResidentForSK.walletAddress) {
      setSkError("This resident has not linked their Stellar wallet address yet. They must bind their wallet before being promoted to SK Official.");
      return;
    }

    onExecute(async (onStatusChange) => {
      const txHash = await verifySKOfficial(adminAddress, selectedResidentForSK.walletAddress!, true, onStatusChange);
      await assignSKOfficial(selectedResidentForSK.uid, skPosition, termStart, termEnd);
      setSelectedResidentForSK(null);
      setTermStart("");
      setTermEnd("");
      return txHash;
    });
  };

  const handleRevokeSK = async (uid: string) => {
    const targetUser = dbUsers.find(u => u.uid === uid);
    if (!targetUser) return;

    if (confirm("Are you sure you want to revoke this SK Official's term and restore them to resident status?")) {
      if (targetUser.walletAddress) {
        onExecute(async (onStatusChange) => {
          const txHash = await verifySKOfficial(adminAddress, targetUser.walletAddress!, false, onStatusChange);
          await revokeSKOfficial(uid);
          alert("SK term revoked successfully.");
          return txHash;
        });
      } else {
        try {
          await revokeSKOfficial(uid);
          alert("SK term revoked successfully.");
        } catch (err: any) {
          setPanelError(err);
        }
      }
    }
  };

  const handleOpenReview = async (user: UserProfile) => {
    setSelectedUser(user);
    setAdminNotes(user.verificationNotes || "");
    const inferredPreset = user.resubmissionPreset || inferResubmissionPreset(user.resubmissionReason || user.autoRejectReason || user.verificationNotes || "");
    setSelectedResubmissionPreset(inferredPreset);
    setSelectedResubmissionFields(
      Array.isArray(user.resubmissionFields) && user.resubmissionFields.length > 0
        ? (user.resubmissionFields as ResubmissionFieldKey[])
        : getResubmissionFieldsForPreset(inferredPreset)
    );
    setAiVerification(null);
    try {
      await lockProfileForReview(user.uid, true);
      if (user.latestVerificationId) {
        const docRef = doc(db, "ai_verifications", user.latestVerificationId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAiVerification(docSnap.data());
        }
      }
    } catch (err) {
      console.error("Failed to load AI verification details:", err);
    }
  };

  const isScopedOverrideCandidate = (user: UserProfile | null) => {
    if (!user) return false;
    if (user.verificationStatus !== "auto_rejected") return false;
    if (profile?.role === "system_admin") return true;
    if (profile?.role !== "barangay_admin") return false;
    if (!profile?.barangayId || profile.barangayId === "unassigned" || profile.barangayId === "N/A") return false;
    const targetBgy = user.barangayId || user.requestedBarangayId || "";
    if (!targetBgy || targetBgy === "unassigned" || targetBgy === "N/A") return false;
    return targetBgy === profile.barangayId;
  };

  const handleCloseReview = async () => {
    if (selectedUser) {
      try {
        await lockProfileForReview(selectedUser.uid, false);
      } catch (err) {
        console.error("Failed to release lock:", err);
      }
    }
    setSelectedUser(null);
    setAiVerification(null);
    setAdminNotes("");
    setSelectedResubmissionPreset("custom");
    setSelectedResubmissionFields([]);
  };

  const handleApprove = async (user: UserProfile, role: "sk" | "youth") => {
    const readyForOnChainSigning = Boolean(user.walletAddress && adminAddress);

    if (role === "youth" && readyForOnChainSigning) {
      onExecute(async (onStatusChange) => {
        let txHash = "";
        const targetWallet = user.walletAddress;
        if (role === "youth") {
          txHash = await verifyResident(adminAddress, targetWallet!, true, onStatusChange);
        } else {
          txHash = await verifySKOfficial(adminAddress, targetWallet!, true, onStatusChange);
        }

        await verifyUserInDb(user.uid, role, true, adminNotes || "Approved by Admin");
        setAdminNotes("");
        setSelectedUser(null);
        return txHash;
      });
      return;
    }

    // Approval is an admin decision and can be persisted without a wallet signature.
    // This allows admin review/activation to proceed even when the selected resident/profile
    // does not yet have an on-chain wallet bound.
    try {
      await verifyUserInDb(user.uid, role, true, adminNotes || "Approved by Admin");
      setAdminNotes("");
      setSelectedUser(null);
    } catch (err: any) {
      setPanelError(err);
    }
  };

  const handleAdminOverride = async (uid: string) => {
    if (!uid) return;
    try {
      await adminOverrideApprove(uid, adminNotes || "Approved by Barangay Admin");
      alert("Override approval recorded and user activated.");
      setAdminNotes("");
      setSelectedUser(null);
      // reload logs to surface the new audit entry
      loadLogsAndBarangays();
    } catch (err: any) {
      console.error("Admin override failed:", err);
      setPanelError(err);
    }
  };

  const handleReject = async (uid: string) => {
    console.debug("[AdminPanel] handleReject triggered for user UID:", uid, { notes: adminNotes });
    if (confirm("Are you sure you want to reject this verification request?")) {
      try {
        await verifyUserInDb(uid, "youth", false, adminNotes || "Rejected by Admin", { action: "full_reject" });
        console.debug("[AdminPanel] handleReject succeeded for user UID:", uid);
        setAdminNotes("");
        setSelectedResubmissionFields([]);
        setSelectedUser(null);
      } catch (err: any) {
        console.error("[AdminPanel] handleReject failed for user UID:", uid, err);
        setPanelError(err);
      }
    }
  };

  const handleRequestResubmission = async (uid: string) => {
    const resolvedFields = selectedResubmissionPreset === "custom"
      ? selectedResubmissionFields
      : getResubmissionFieldsForPreset(selectedResubmissionPreset);
    const suggestedReason = getResubmissionSuggestedReasonForPreset(selectedResubmissionPreset, resolvedFields);
    const note = adminNotes || suggestedReason || "Resubmission requested.";
    if (confirm("Are you sure you want to request document resubmission? The resident will stay inside the dashboard, but only the selected fields will be eligible for resubmission.")) {
      try {
        await verifyUserInDb(uid, "youth", false, note, {
          action: "resubmission_required",
          preset: selectedResubmissionPreset,
          resubmissionFields: resolvedFields,
          suggestedReason,
        });
        alert("Resubmission request sent successfully.");
        setAdminNotes("");
        setSelectedResubmissionPreset("custom");
        setSelectedResubmissionFields([]);
        setSelectedUser(null);
      } catch (err: any) {
        setPanelError(err);
      }
    }
  };

  const getDuplicateRisk = (user: UserProfile) => {
    if (!user) return { level: "Low", text: "🟢 No Duplicate Detected", color: "badge-success", reasons: [] as string[] };
    const others = dbUsers.filter(u => u.uid !== user.uid);
    let isConfirmed = false;
    let isHighConfidence = false;
    let isPossible = false;
    let matchReasons: string[] = [];

    others.forEach(u => {
      // 1. Confirmed Duplicate: exact critical unique identifier match
      const idMatch = u.idNumber && user.idNumber && u.idNumber.trim().toLowerCase() === user.idNumber.trim().toLowerCase();
      const walletMatch = u.walletAddress && user.walletAddress && u.walletAddress.trim().toLowerCase() === user.walletAddress.trim().toLowerCase();
      const emailMatch = u.email && user.email && u.email.trim().toLowerCase() === user.email.trim().toLowerCase();
      const studentMatch = u.schoolName && user.schoolName && u.studentNumber && user.studentNumber &&
        u.schoolName.trim().toLowerCase() === user.schoolName.trim().toLowerCase() &&
        u.studentNumber.trim().toLowerCase() === user.studentNumber.trim().toLowerCase();

      if (idMatch || walletMatch || emailMatch || studentMatch) {
        isConfirmed = true;
        if (idMatch) matchReasons.push(`Confirmed duplicate ID Number: ${user.idNumber}`);
        if (walletMatch) matchReasons.push("Confirmed duplicate Wallet address");
        if (emailMatch) matchReasons.push(`Confirmed duplicate Email: ${user.email}`);
        if (studentMatch) matchReasons.push(`Confirmed duplicate Student ID Number: ${user.studentNumber}`);
      }

      // 2. High Confidence Duplicate: name + birthdate, or mobile match, or address + birthdate
      const nameMatch = u.name && user.name && u.name.trim().toLowerCase() === user.name.trim().toLowerCase();
      const birthMatch = u.birthdate && user.birthdate && u.birthdate === user.birthdate;
      const phoneMatch = u.mobileNumber && user.mobileNumber && u.mobileNumber.trim() === user.mobileNumber.trim();
      const addressMatch = u.address && user.address && u.address.trim().toLowerCase() === user.address.trim().toLowerCase();

      if ((nameMatch && birthMatch) || phoneMatch || (addressMatch && nameMatch)) {
        isHighConfidence = true;
        if (nameMatch && birthMatch) matchReasons.push("Matches name and birthdate");
        if (phoneMatch) matchReasons.push(`Duplicate phone number: ${user.mobileNumber}`);
        if (addressMatch && nameMatch) matchReasons.push("Matches name and address");
      }

      // 3. Possible Duplicate: fuzzy name match, or exact address, or exact name
      const fuzzyNameSim = getFuzzySimilarity(user.name, u.name);
      if (fuzzyNameSim >= 70 || nameMatch || addressMatch) {
        isPossible = true;
        if (fuzzyNameSim >= 70 && !nameMatch) matchReasons.push(`Fuzzy name match (${fuzzyNameSim}% similarity)`);
        if (nameMatch && !(nameMatch && birthMatch)) matchReasons.push(`Matches exact name`);
        if (addressMatch && !(addressMatch && nameMatch)) matchReasons.push(`Matches exact address`);
      }
    });

    if (isConfirmed) {
      return { level: "Confirmed", text: "🔴 Confirmed Duplicate", color: "badge-danger", reasons: matchReasons };
    }
    if (isHighConfidence) {
      return { level: "High", text: "🟠 High Confidence Duplicate", color: "badge-warning", reasons: matchReasons };
    }
    if (isPossible) {
      return { level: "Possible", text: "🟡 Possible Duplicate", color: "badge-info", reasons: matchReasons };
    }
    return { level: "Low", text: "🟢 No Duplicate Detected", color: "badge-success", reasons: [] as string[] };
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  const getInitials = (name: string) => {
    return name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?";
  };

  const getAge = (birthdate: string) => {
    if (!birthdate) return 0;
    const birthYear = new Date(birthdate).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  };

  // Scoped views checks
  const isSysAdmin = profile?.role === "system_admin";
  const isBgyAdmin = profile?.role === "barangay_admin";

  const hasActiveAdmin = (barangayId: string) => {
    if (!barangayId || barangayId === "N/A") return false;
    return dbUsers.some(
      u => u.role === "barangay_admin" &&
        u.verificationStatus === "approved" &&
        u.barangayId === barangayId &&
        u.status === "active"
    );
  };

  // Scoped stats filters
  const pendingAdmins = dbUsers.filter(u => (u.role === "barangay_admin" || u.requestedRole === "barangay_admin") && u.verificationStatus === "pending");
  const pendingAdminsForSys = pendingAdmins.filter(adm => !hasActiveAdmin(adm.requestedBarangayId || ""));
  const pendingAdminsForBgy = pendingAdmins.filter(adm => adm.requestedBarangayId === profile?.barangayId);
  const activeAdmins = dbUsers.filter(u => (u.role === "barangay_admin" || u.requestedRole === "barangay_admin") && u.verificationStatus === "approved");

  const pendingResidents = dbUsers.filter(
    u => u.role === "resident" &&
      (u.verificationStatus === "pending" || u.verificationStatus === "ai_verified" || u.verificationStatus === "auto_rejected") &&
      u.barangayId === profile?.barangayId
  );

  const activeResidents = dbUsers.filter(
    u => u.role === "resident" &&
      u.verificationStatus === "approved" &&
      u.barangayId === profile?.barangayId
  );

  const activeSKOfficials = dbUsers.filter(
    u => u.role === "sk_official" &&
      u.status === "active" &&
      u.barangayId === profile?.barangayId
  );

  const barangayResidents = dbUsers.filter(u => {
    const isSameBarangay = u.barangayId === profile?.barangayId;
    const isNotAdmin = u.role !== "barangay_admin" && u.role !== "system_admin" && u.requestedRole !== "barangay_admin";
    if (!isSameBarangay || !isNotAdmin) return false;

    if (residentFilter === "pending") {
      return u.verificationStatus === "pending" || u.verificationStatus === "ai_verified" || u.verificationStatus === "auto_rejected";
    }
    if (residentFilter === "approved") {
      return u.verificationStatus === "approved";
    }
    if (residentFilter === "rejected") {
      return u.verificationStatus === "rejected";
    }
    return true;
  });

  return (
    <div className="admin-dashboard-layout" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ========================================================================= */}
      {/* 🛠️ PLATFORM SYSTEM ADMIN CONSOLE */}
      {/* ========================================================================= */}
      {isSysAdmin && (
        <>
          <div className="stats-row grid-3 mb-4">
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <AlertCircle size={16} /> Pending Admins
              </span>
              <span className="stats-value">{pendingAdminsForSys.length}</span>
              <span className="stats-desc">Awaiting primary assignment</span>
            </div>
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <UserCheck size={16} /> Active Admins
              </span>
              <span className="stats-value">{activeAdmins.length}</span>
              <span className="stats-desc">Approved scoped administrators</span>
            </div>
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <History size={16} /> Audit Records
              </span>
              <span className="stats-value">{logs.length}</span>
              <span className="stats-desc">Platform-wide compliance counts</span>
            </div>
          </div>

          <div className="panel-card">
            <h2 className="panel-title">Pending Barangay Admins Queue</h2>
            <p className="panel-subtitle">Approve new Barangay Admin applications for unadministered boundaries.</p>

            {pendingAdminsForSys.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                <CheckCircle2 size={36} style={{ color: "#10b981", margin: "0 auto 1rem auto" }} />
                <p>All unadministered boundaries have active assigned admins.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Profession & Purpose</th>
                      <th>ID Credentials</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingAdminsForSys.map(adm => (
                      <tr key={adm.uid}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div className="avatar-circle">
                              {adm.profilePhotoUrl && adm.profilePhotoUrl !== "N/A" ? (
                                <img src={adm.profilePhotoUrl} alt={adm.name} />
                              ) : (
                                getInitials(adm.name)
                              )}
                            </div>
                            <div>
                              <strong>{adm.name}</strong>
                              <div className="text-muted-sm">{adm.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{adm.professionalInfo || "N/A"}</div>
                          <div className="text-secondary-sm" style={{ fontStyle: "italic", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={adm.adminReason}>
                            "{adm.adminReason || "No purpose statement provided"}"
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info">{adm.idType?.toUpperCase() || "ID"}</span>
                          <div className="text-muted-sm">{adm.idNumber || "N/A"}</div>
                        </td>
                        <td>
                          {adm.currentlyReviewedBy ? (
                            <span className="badge badge-warning">🔒 Locked by {adm.currentlyReviewedBy}</span>
                          ) : (
                            <span className="badge badge-success">🟢 Ready for Audit</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleOpenReview(adm)}
                            disabled={adm.currentlyReviewedBy !== undefined && adm.currentlyReviewedBy !== null && adm.currentlyReviewedBy !== profile?.name}
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                          >
                            <Eye size={14} /> Review & Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Barangay Admins Soft Suspension Directory */}
          <div className="panel-card">
            <h2 className="panel-title">Barangay Admins Registry</h2>
            <p className="panel-subtitle">Suspend or reactivate admin privileges. Suspensions dynamically reject entry logs.</p>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Assigned LGU</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAdmins.map(adm => (
                    <tr key={adm.uid}>
                      <td>
                        <strong>{adm.name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{adm.email}</div>
                      </td>
                      <td>{adm.barangayName}</td>
                      <td>
                        <span className={`badge ${adm.status === "active" ? "badge-success" : "badge-danger"}`}>
                          {adm.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {adm.status === "active" ? (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleSuspendAdmin(adm.uid, true)}>
                            <Ban size={12} style={{ marginRight: "0.25rem" }} /> Suspend Admin
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-outline-success" onClick={() => handleSuspendAdmin(adm.uid, false)}>
                            <RefreshCw size={12} style={{ marginRight: "0.25rem" }} /> Lift Suspension
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Platform compliance audit logs feed */}
          <div className="panel-card">
            <h2 className="panel-title">Global Compliance Audit Log</h2>
            <p className="panel-subtitle">View platform-wide verification, governance, and financial records.</p>

            <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
              <select className="form-control" value={logsFilterCategory} onChange={e => setLogsFilterCategory(e.target.value)}>
                <option value="">-- All Categories --</option>
                <option value="Authentication">Authentication</option>
                <option value="Verification">Verification</option>
                <option value="Governance">Governance</option>
                <option value="Escrow">Escrow</option>
                <option value="Administration">Administration</option>
              </select>
              <select className="form-control" value={logsFilterSeverity} onChange={e => setLogsFilterSeverity(e.target.value)}>
                <option value="">-- All Severities --</option>
                <option value="Info">Info</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs
                    .filter(l => !logsFilterCategory || l.category === logsFilterCategory)
                    .filter(l => !logsFilterSeverity || l.severity === logsFilterSeverity)
                    .map(l => (
                      <tr key={l.id}>
                        <td style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{new Date(l.timestamp).toLocaleString()}</td>
                        <td><span className="badge badge-info">{l.category}</span></td>
                        <td>
                          <span className={`badge ${l.severity === "Critical" ? "badge-danger" : l.severity === "Warning" ? "badge-warning" : "badge-success"}`}>
                            {l.severity}
                          </span>
                        </td>
                        <td>
                          <strong>{l.actorName}</strong>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{l.actorRole}</div>
                        </td>
                        <td>
                          {l.targetName || "N/A"}
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{l.targetRole}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: "0.82rem" }}>{l.notes}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 🏢 LOCAL BARANGAY ADMIN CONSOLE */}
      {/* ========================================================================= */}
      {isBgyAdmin && (
        <>
          <div className="stats-row grid-4 mb-4">
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <AlertCircle size={16} /> Pending Residents
              </span>
              <span className="stats-value">{pendingResidents.length}</span>
              <span className="stats-desc">Awaiting identity audits</span>
            </div>
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <UserCheck size={16} /> Active Residents
              </span>
              <span className="stats-value">{activeResidents.length}</span>
              <span className="stats-desc">Verified voting auditors</span>
            </div>
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <ShieldCheck size={16} /> SK Officials
              </span>
              <span className="stats-value">{activeSKOfficials.length}</span>
              <span className="stats-desc">Active SK Council positions</span>
            </div>
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Radio size={16} /> Boundary LGU
              </span>
              <span className="stats-value" style={{ fontSize: "1.1rem", fontWeight: 800 }}>{profile?.barangayName}</span>
              <span className="stats-desc">Only display local boundary data</span>
            </div>
          </div>

          <div className="grid-2">
            {/* Pending Residents Verification Queue */}
            <div className="panel-card">
              <h2 className="panel-title">Pending Residents Queue</h2>
              <p className="panel-subtitle">Review local signups. Double audits are blocked by concurrent review locks.</p>

              {pendingResidents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                  <CheckCircle2 size={36} style={{ color: "#10b981", margin: "0 auto 1rem auto" }} />
                  <p>All local residency registration queues are clear.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Resident</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingResidents.map(res => (
                        <tr key={res.uid}>
                          <td>
                            <strong>{res.name}</strong>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{res.email}</div>
                          </td>
                          <td>
                            {res.currentlyReviewedBy ? (
                              <span style={{ color: "#f59e0b", fontSize: "0.75rem", fontWeight: 700 }}>
                                🔒 Reviewing: {res.currentlyReviewedBy}
                              </span>
                            ) : (
                              <span style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600 }}>🟢 Open</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleOpenReview(res)}
                              disabled={res.currentlyReviewedBy !== undefined && res.currentlyReviewedBy !== null && res.currentlyReviewedBy !== profile?.name}
                            >
                              Audit ID
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SK Officials Promotions Cabinet */}
            <div className="panel-card">
              <h2 className="panel-title">SK Council Cabinet</h2>
              <p className="panel-subtitle">Assign active Residents to explicit SK positions or revoke term privileges.</p>

              <form onSubmit={handlePromoteSK} className="panel-form mb-4" style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "1.5rem" }}>
                {skError && <p className="form-error-msg mb-2">{skError}</p>}

                <div className="form-group">
                  <label>Select Verified Resident</label>
                  <select
                    className="form-control"
                    onChange={e => {
                      const res = activeResidents.find(r => r.uid === e.target.value);
                      setSelectedResidentForSK(res || null);
                    }}
                    required
                  >
                    <option value="">-- Choose Resident --</option>
                    {activeResidents.map(res => (
                      <option key={res.uid} value={res.uid}>{res.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label>SK Position</label>
                    <select className="form-control" value={skPosition} onChange={e => setSkPosition(e.target.value as any)}>
                      <option value="chairman">SK Chairman</option>
                      <option value="kagawad">SK Kagawad</option>
                      <option value="secretary">SK Secretary</option>
                      <option value="treasurer">SK Treasurer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Term Start Date</label>
                    <input type="date" className="form-control" value={termStart} onChange={e => setTermStart(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Term End Date</label>
                  <input type="date" className="form-control" value={termEnd} onChange={e => setTermEnd(e.target.value)} required />
                </div>

                <button type="submit" className="btn btn-primary w-100">Promote to SK Position</button>
              </form>

              {/* Active SK Slots */}
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Official</th>
                      <th>Position</th>
                      <th>Term End</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSKOfficials.map(sk => (
                      <tr key={sk.uid}>
                        <td>
                          <strong>{sk.name}</strong>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{sk.email}</div>
                        </td>
                        <td><span className="badge badge-warning">{sk.position.toUpperCase()}</span></td>
                        <td style={{ fontSize: "0.85rem", fontFamily: "monospace" }}>{sk.termEnd}</td>
                        <td>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleRevokeSK(sk.uid)}>
                            <UserX size={12} style={{ marginRight: "0.25rem" }} /> Revoke Term
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Local Barangay Admin Approval Queue */}
          <div className="panel-card">
            <h2 className="panel-title">Pending Co-Admins Queue</h2>
            <p className="panel-subtitle">Approve additional administrator requests for your local Barangay jurisdiction.</p>

            {pendingAdminsForBgy.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                <CheckCircle2 size={32} style={{ color: "#10b981", margin: "0 auto 1rem auto" }} />
                <p>No pending co-administrator requests for your Barangay.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Profession & Purpose</th>
                      <th>ID Credentials</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingAdminsForBgy.map(adm => (
                      <tr key={adm.uid}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div className="avatar-circle">
                              {adm.profilePhotoUrl && adm.profilePhotoUrl !== "N/A" ? (
                                <img src={adm.profilePhotoUrl} alt={adm.name} />
                              ) : (
                                getInitials(adm.name)
                              )}
                            </div>
                            <div>
                              <strong>{adm.name}</strong>
                              <div className="text-muted-sm">{adm.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{adm.professionalInfo || "N/A"}</div>
                          <div className="text-secondary-sm" style={{ fontStyle: "italic", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={adm.adminReason}>
                            "{adm.adminReason || "No purpose statement provided"}"
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info">{adm.idType?.toUpperCase() || "ID"}</span>
                          <div className="text-muted-sm">{adm.idNumber || "N/A"}</div>
                        </td>
                        <td>
                          {adm.currentlyReviewedBy ? (
                            <span className="badge badge-warning">🔒 Locked by {adm.currentlyReviewedBy}</span>
                          ) : (
                            <span className="badge badge-success">🟢 Ready for Audit</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleOpenReview(adm)}
                            disabled={adm.currentlyReviewedBy !== undefined && adm.currentlyReviewedBy !== null && adm.currentlyReviewedBy !== profile?.name}
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                          >
                            <Eye size={14} /> Review & Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Local LGU audit log feed */}
          <div className="panel-card">
            <h2 className="panel-title">Barangay Audit Log Feed</h2>
            <p className="panel-subtitle">Local compliance logs matching Barangay boundary filters.</p>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {logs
                    .filter(l => l.barangayId === profile?.barangayId)
                    .map(l => (
                      <tr key={l.id}>
                        <td style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{new Date(l.timestamp).toLocaleString()}</td>
                        <td>
                          <strong>{l.actorName}</strong>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{l.actorRole}</div>
                        </td>
                        <td><span className="badge badge-info">{l.action.toUpperCase()}</span></td>
                        <td><span style={{ fontSize: "0.82rem" }}>{l.notes}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 👥 Barangay Residents Directory */}
          <div className="panel-card mt-4">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <h2 className="panel-title">Local Residents Directory</h2>
                <p className="panel-subtitle">View and audit all resident profiles under your Barangay's custody.</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(["all", "pending", "approved", "rejected"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setResidentFilter(tab)}
                    className={`btn btn-sm ${residentFilter === tab ? "btn-primary" : "btn-outline-secondary"}`}
                    style={{ textTransform: "capitalize" }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {barangayResidents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                <p>No residents found matching the "{residentFilter}" status filter.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Resident Profile</th>
                      <th>Age / Birthdate</th>
                      <th>Stellar Wallet</th>
                      <th>Verification Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barangayResidents.map(res => {
                      const walletLinked = !!res.walletAddress;

                      let statusBadge = "badge-secondary";
                      let statusText = res.verificationStatus || "pending";
                      if (res.verificationStatus === "approved") {
                        statusBadge = "badge-success";
                        statusText = "approved";
                      } else if (res.verificationStatus === "rejected") {
                        statusBadge = "badge-danger";
                        statusText = "rejected";
                      } else if (res.verificationStatus === "auto_rejected") {
                        statusBadge = "badge-danger";
                        statusText = "auto_rejected";
                      } else if (res.verificationStatus === "ai_verified") {
                        statusBadge = "badge-info";
                        statusText = "ai_verified";
                      } else {
                        statusBadge = "badge-warning";
                        statusText = "pending";
                      }

                      return (
                        <tr key={res.uid}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              <div className="avatar-circle">
                                {res.profilePhotoUrl && res.profilePhotoUrl !== "N/A" ? (
                                  <img src={res.profilePhotoUrl} alt={res.name} />
                                ) : (
                                  getInitials(res.name)
                                )}
                              </div>
                              <div>
                                <strong style={{ color: "var(--text-primary)" }}>{res.name}</strong>
                                <div className="text-muted-sm">{res.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{res.age || getAge(res.birthdate)} yrs old</div>
                            <div className="text-muted-sm">{res.birthdate || "No birthdate"}</div>
                          </td>
                          <td>
                            {walletLinked ? (
                              <div>
                                <span className="badge badge-success">✓ Bound</span>
                                <div className="text-muted-sm" style={{ fontFamily: "monospace" }}>
                                  {`${res.walletAddress!.slice(0, 6)}...${res.walletAddress!.slice(-6)}`}
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-secondary">Unbound</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${statusBadge}`}>{statusText.toUpperCase()}</span>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleOpenReview(res)}
                              style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                            >
                              <Eye size={14} /> Review & Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 📁 RESIDENT VERIFICATION DRAWER */}
      {/* ========================================================================= */}
      {selectedUser && (() => {
        const isTargetAdmin = selectedUser.requestedRole === "barangay_admin" || selectedUser.role === "barangay_admin";
        return (
          <>
            <div
              style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)", zIndex: 199 }}
              onClick={handleCloseReview}
            />
            <aside className="identity-detail-drawer" style={{ display: "flex", flexDirection: "column" }}>
              <div className="drawer-header">
                <h3 style={{ fontWeight: 800, color: "var(--text-primary)" }}>
                  {isTargetAdmin ? "Barangay Admin ID Audit" : "Resident ID Audit"}
                </h3>
                <button
                  onClick={handleCloseReview}
                  style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Concurrent review warning locks */}
              {selectedUser.currentlyReviewedBy && selectedUser.currentlyReviewedBy !== profile?.name && (
                <div style={{ background: "#fffbeb", borderBottom: "1px solid #fef3c7", color: "#b45309", padding: "0.75rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <AlertCircle size={14} /> WARNING: This profile is currently being reviewed by admin {selectedUser.currentlyReviewedBy}.
                </div>
              )}

              <div className="drawer-body" style={{ flex: 1, overflowY: "auto", paddingRight: "0.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1rem 0" }}>
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      color: "#475569",
                      border: "3px solid var(--primary)",
                      fontSize: "1.6rem",
                      overflow: "hidden",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      cursor: selectedUser.profilePhotoUrl && selectedUser.profilePhotoUrl !== "N/A" ? "zoom-in" : "default"
                    }}
                    onClick={() => {
                      if (selectedUser.profilePhotoUrl && selectedUser.profilePhotoUrl !== "N/A") {
                        setZoomImage({ url: selectedUser.profilePhotoUrl, title: `Profile Photo - ${selectedUser.name}` });
                        setZoomLevel(1);
                        setZoomRotation(0);
                      }
                    }}
                    title={selectedUser.profilePhotoUrl && selectedUser.profilePhotoUrl !== "N/A" ? "Click to Zoom Profile Photo" : selectedUser.name}
                  >
                    {selectedUser.profilePhotoUrl && selectedUser.profilePhotoUrl !== "N/A" ? (
                      <img src={selectedUser.profilePhotoUrl} alt={selectedUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      getInitials(selectedUser.name)
                    )}
                  </div>
                  <h4 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{selectedUser.name}</h4>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{selectedUser.email}</span>
                </div>

                {/* --- AI Identity Verification Details --- */}
                {aiVerification ? (
                  <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #cbd5e1", borderRadius: "16px", padding: "1.2rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>AI verification report</span>
                      {(() => {
                        const confidence = aiVerification.confidence ?? (100 - (aiVerification.riskScore || 0));
                        let color = "badge-success";
                        let level = "Low Risk";
                        if (confidence === 100 || (confidence >= 95 && confidence <= 99)) {
                          color = "badge-success";
                          level = "Low Risk";
                        } else if (confidence >= 70 && confidence <= 94) {
                          color = "badge-info";
                          level = "Medium Risk";
                        } else if (confidence >= 40 && confidence <= 69) {
                          color = "badge-warning";
                          level = "High Risk";
                        } else {
                          color = "badge-danger";
                          level = "Critical Risk";
                        }
                        return (
                          <span className={`badge ${color}`} style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}>
                            AI Confidence: {confidence}% ({level})
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid-2" style={{ gap: "0.75rem", background: "#ffffff", padding: "0.85rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Decision:</span>{" "}
                        <strong style={{
                          color: aiVerification.recommendation === "AUTO_ACCEPT" ? "#10b981" : aiVerification.recommendation === "AUTO_REJECT" ? "#ef4444" : "#f59e0b"
                        }}>
                          {aiVerification.recommendation === "AUTO_ACCEPT" ? "AUTO ACCEPT" : aiVerification.recommendation === "AUTO_REJECT" ? "AUTO REJECTED" : "MANUAL REVIEW"}
                        </strong>
                      </div>
                      <div style={{ fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Confidence:</span>{" "}
                        <strong>{aiVerification.confidence}%</strong>
                      </div>
                      <div style={{ fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Document Type:</span>{" "}
                        <strong>{aiVerification.documentType}</strong>
                      </div>
                      <div style={{ fontSize: "0.8rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Duplicates:</span>{" "}
                        {(() => {
                          const risk = getDuplicateRisk(selectedUser);
                          return (
                            <strong style={{ color: risk.level === "Confirmed" || risk.level === "High" ? "#ef4444" : risk.level === "Possible" ? "#f59e0b" : "#10b981" }}>
                              {risk.text.replace("🟢 ", "").replace("🔴 ", "").replace("🟠 ", "").replace("🟡 ", "")}
                            </strong>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Fraud Indicators Checklist */}
                    <div style={{ fontSize: "0.78rem", background: "rgba(0,0,0,0.01)", padding: "0.75rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontWeight: 700, display: "block", marginBottom: "0.4rem", color: "var(--text-primary)" }}>Safety & Tampering Analysis:</span>
                      <div className="grid-2" style={{ gap: "0.4rem" }}>
                        <div>👤 Face Present: <span style={{ color: aiVerification.faceDetected ? "#10b981" : "#ef4444", fontWeight: 700 }}>{aiVerification.faceDetected ? "YES" : "NO"}</span></div>
                        <div>🛡️ Tampering: <span style={{ color: aiVerification.tamperingDetected ? "#ef4444" : "#10b981", fontWeight: 700 }}>{aiVerification.tamperingDetected ? "YES" : "NO"}</span></div>
                        <div>📸 Screenshot: <span style={{ color: aiVerification.screenshotDetected ? "#ef4444" : "#10b981", fontWeight: 700 }}>{aiVerification.screenshotDetected ? "YES" : "NO"}</span></div>
                        <div>🤖 AI-Generated: <span style={{ color: aiVerification.aiGeneratedDetected ? "#ef4444" : "#10b981", fontWeight: 700 }}>{aiVerification.aiGeneratedDetected ? "YES" : "NO"}</span></div>
                      </div>
                    </div>

                    {/* OCR Verification Fields grid */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #cbd5e1", color: "var(--text-secondary)" }}>
                            <th style={{ padding: "0.3rem" }}>Field Name</th>
                            <th style={{ padding: "0.3rem" }}>Declared</th>
                            <th style={{ padding: "0.3rem" }}>Extracted (OCR)</th>
                            <th style={{ padding: "0.3rem" }}>Status</th>
                            <th style={{ padding: "0.3rem" }}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(aiVerification.fieldMatches || {}).map(([key, match]: [string, any]) => {
                            const statusText = match.status === "PASS" ? "Match" : match.status === "WARNING" ? "Partial Match" : "Mismatch";
                            const statusColor = match.status === "PASS" ? "#10b981" : match.status === "WARNING" ? "#f59e0b" : "#ef4444";
                            return (
                              <tr key={key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "0.3rem", fontWeight: 600, textTransform: "capitalize" }}>{key}</td>
                                <td style={{ padding: "0.3rem", color: "var(--text-secondary)" }} title={match.originalValue}>{match.originalValue || "N/A"}</td>
                                <td style={{ padding: "0.3rem", color: "var(--text-primary)" }} title={match.extractedValue}>{match.extractedValue || "N/A"}</td>
                                <td style={{ padding: "0.3rem" }}>
                                  <span style={{ color: statusColor, fontWeight: 700 }}>
                                    {statusText}
                                  </span>
                                </td>
                                <td style={{ padding: "0.3rem", fontWeight: 600 }}>{match.confidence}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Explainable AI reasons */}
                    <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.3rem" }}>AI Verification Reasons:</span>
                      <ul style={{ paddingLeft: "1.2rem", margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {aiVerification.reasons.map((reason: string, idx: number) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid #f59e0b", borderRadius: "12px", padding: "1rem", marginBottom: "1.2rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <AlertCircle size={16} style={{ color: "#d97706" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "#b45309" }}>AI Verification Log Offline</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      {selectedUser.verificationNotes || "Gemini AI analysis details are missing for this user. Auditing resident document status via manual review."}
                    </p>
                    {/* Local Duplicate checks */}
                    <div style={{ marginTop: "0.5rem", borderTop: "1px solid #fed7aa", paddingTop: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>Local Database Scan:</span>
                      {(() => {
                        const risk = getDuplicateRisk(selectedUser);
                        return (
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.25rem" }}>
                            <span className={`badge ${risk.color}`} style={{ padding: "0.15rem 0.4rem", fontSize: "0.68rem" }}>{risk.text}</span>
                            {risk.reasons.length > 0 && <span style={{ fontSize: "0.68rem", color: "var(--danger)" }}>({risk.reasons[0]})</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Desired Role:</span>
                    <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{selectedUser.requestedRole}</span>
                  </div>
                  {!isTargetAdmin && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Barangay Location:</span>
                      <span style={{ fontWeight: 700 }}>{selectedUser.barangayName}</span>
                    </div>
                  )}
                  {isTargetAdmin && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Professional Occupation:</span>
                        <span style={{ fontWeight: 700 }}>{selectedUser.professionalInfo || "N/A"}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Application Purpose:</span>
                        <span style={{ fontWeight: 500, fontStyle: "italic", fontSize: "0.85rem", marginTop: "0.1rem" }}>"{selectedUser.adminReason || "N/A"}"</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Birthdate / Age:</span>
                    <span style={{ fontWeight: 700 }}>{selectedUser.birthdate} ({getAge(selectedUser.birthdate)} yrs)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Mobile Number:</span>
                    <span style={{ fontWeight: 700 }}>{selectedUser.mobileNumber || "N/A"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Address:</span>
                    <span style={{ fontWeight: 700 }}>{selectedUser.address || "N/A"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>ID Document Type:</span>
                    <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{selectedUser.idType || "N/A"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>ID Document Number:</span>
                    <span style={{ fontWeight: 700 }}>{selectedUser.idNumber || "N/A"}</span>
                  </div>
                  {selectedUser.idType === "student" && selectedUser.schoolName && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>School/University:</span>
                      <span style={{ fontWeight: 700 }}>{selectedUser.schoolName}</span>
                    </div>
                  )}
                  {/* --- Uploaded Verification Photos Gallery --- */}
                  <div style={{ marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", display: "block", marginBottom: "0.75rem" }}>
                      Uploaded Verification Documents & Media ({[selectedUser.profilePhotoUrl, selectedUser.idPhotoUrl, selectedUser.selfiePhotoUrl].filter(u => u && u !== "N/A").length})
                    </span>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "0.75rem"
                    }}>
                      {/* 1. Profile Photo Card */}
                      {selectedUser.profilePhotoUrl && selectedUser.profilePhotoUrl !== "N/A" && (
                        <div className="doc-inspect-card">
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title="Applicant Profile Photo">
                            📷 Profile Photo
                          </span>
                          <div
                            className="doc-inspect-thumbnail"
                            onClick={() => {
                              setZoomImage({ url: selectedUser.profilePhotoUrl!, title: `Profile Photo - ${selectedUser.name}` });
                              setZoomLevel(1);
                              setZoomRotation(0);
                            }}
                          >
                            <img src={selectedUser.profilePhotoUrl} alt="Profile Picture" />
                            <div className="doc-inspect-overlay">
                              <span className="doc-inspect-badge">
                                <ZoomIn size={12} /> Inspect
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. ID Document Photo Card */}
                      {selectedUser.idPhotoUrl && selectedUser.idPhotoUrl !== "N/A" && (
                        <div className="doc-inspect-card">
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={`${selectedUser.idType ? selectedUser.idType.toUpperCase() : "GOVERNMENT"} ID`}>
                            🪪 {selectedUser.idType ? selectedUser.idType.toUpperCase() : "GOV"} ID
                          </span>
                          <div
                            className="doc-inspect-thumbnail"
                            onClick={() => {
                              setZoomImage({ url: selectedUser.idPhotoUrl!, title: `Government ID (${selectedUser.idType?.toUpperCase() || "ID"}) - ${selectedUser.name}` });
                              setZoomLevel(1);
                              setZoomRotation(0);
                            }}
                          >
                            <img src={selectedUser.idPhotoUrl} alt="ID Document" />
                            <div className="doc-inspect-overlay">
                              <span className="doc-inspect-badge">
                                <ZoomIn size={12} /> Inspect
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. Selfie with ID Photo Card */}
                      {selectedUser.selfiePhotoUrl && selectedUser.selfiePhotoUrl !== "N/A" && (
                        <div className="doc-inspect-card">
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title="Selfie holding ID Document">
                            🤳 Selfie with ID
                          </span>
                          <div
                            className="doc-inspect-thumbnail"
                            onClick={() => {
                              setZoomImage({ url: selectedUser.selfiePhotoUrl!, title: `Selfie with ID - ${selectedUser.name}` });
                              setZoomLevel(1);
                              setZoomRotation(0);
                            }}
                          >
                            <img src={selectedUser.selfiePhotoUrl} alt="Selfie Verification" />
                            <div className="doc-inspect-overlay">
                              <span className="doc-inspect-badge">
                                <ZoomIn size={12} /> Inspect
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Stellar Public Address:</span>
                    {selectedUser.walletAddress ? (
                      <code style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {selectedUser.walletAddress}
                      </code>
                    ) : (
                      <span style={{ color: "#ef4444", fontSize: "0.85rem", fontWeight: 600 }}>Applicant hasn't linked a Stellar Wallet key.</span>
                    )}
                  </div>

                  {/* Audit timeline details */}
                  <div style={{ marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>Audit Log Timeline</span>
                    <div className="tx-timeline" style={{ marginTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.82rem" }}>
                        <span className="badge badge-success" style={{ height: "20px", width: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>1</span>
                        <div>
                          <strong>Account Registered</strong>
                          <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.1rem" }}>
                            Created: {new Date(selectedUser.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.82rem" }}>
                        <span className="badge badge-success" style={{ height: "20px", width: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>2</span>
                        <div>
                          <strong>Credentials Logged</strong>
                          <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.1rem" }}>
                            ID: {selectedUser.idType.toUpperCase()} (Num: {selectedUser.idNumber})
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.82rem" }}>
                        <span className={`badge ${selectedUser.walletAddress ? "badge-success" : "badge-warning"}`} style={{ height: "20px", width: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>3</span>
                        <div>
                          <strong>Wallet Binding</strong>
                          <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.1rem" }}>
                            {selectedUser.walletAddress ? `Linked: ${truncateAddress(selectedUser.walletAddress)}` : "Awaiting signature"}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.82rem" }}>
                        <span className={`badge ${selectedUser.verificationStatus === "approved" ? "badge-success" : "badge-warning"}`} style={{ height: "20px", width: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>4</span>
                        <div>
                          <strong>Identity Approval Status</strong>
                          <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.1rem" }}>
                            Status: {selectedUser.verificationStatus.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit verification notes textarea */}
                  <div className="form-group" style={{ marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 700 }}>Resubmission Scope</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      {RESUBMISSION_FIELD_OPTIONS.map((option) => {
                        const active = selectedResubmissionFields.includes(option.key);
                        return (
                          <button
                            key={option.key}
                            type="button"
                            className={`badge ${active ? "badge-primary" : "badge-secondary"}`}
                            onClick={() => {
                              setSelectedResubmissionFields((prev) =>
                                active ? prev.filter((field) => field !== option.key) : [...prev, option.key]
                              );
                            }}
                            style={{ cursor: "pointer", border: "none", padding: "0.5rem 0.75rem", borderRadius: "999px" }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {selectedResubmissionFields.length > 0 && (
                      <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: "10px", padding: "0.75rem", color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
                        <strong>Suggested reason:</strong> {getResubmissionSuggestedReasonForPreset(selectedResubmissionPreset, selectedResubmissionFields)}
                      </div>
                    )}
                    <label>Audit Verification Notes / Remarks</label>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 700 }}>Resubmission Decision</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      {RESUBMISSION_PRESETS.map((preset) => {
                        const active = selectedResubmissionPreset === preset.key;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            className={`badge ${active ? "badge-primary" : "badge-secondary"}`}
                            onClick={() => {
                              setSelectedResubmissionPreset(preset.key);
                              if (preset.key !== "custom") {
                                setSelectedResubmissionFields(getResubmissionFieldsForPreset(preset.key));
                              }
                            }}
                            style={{ cursor: "pointer", border: "none", padding: "0.55rem 0.8rem", borderRadius: "999px" }}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: "10px", padding: "0.85rem", marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.25rem" }}>AUTO-SUGGESTED RESUBMISSION</div>
                      <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 600 }}>{getResubmissionPresetLabel(selectedResubmissionPreset)}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        {getResubmissionPresetDescription(selectedResubmissionPreset)}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      {(selectedResubmissionFields.length > 0 ? selectedResubmissionFields : getResubmissionFieldsForPreset(selectedResubmissionPreset)).map((fieldKey) => (
                        <span key={fieldKey} className="badge badge-warning" style={{ whiteSpace: "nowrap" }}>
                          {getResubmissionFieldLabel(fieldKey)}
                        </span>
                      ))}
                    </div>
                    {selectedResubmissionPreset === "custom" && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        {RESUBMISSION_FIELD_OPTIONS.map((option) => {
                          const active = selectedResubmissionFields.includes(option.key);
                          return (
                            <button
                              key={option.key}
                              type="button"
                              className={`badge ${active ? "badge-primary" : "badge-secondary"}`}
                              onClick={() => {
                                setSelectedResubmissionFields((prev) =>
                                  active ? prev.filter((field) => field !== option.key) : [...prev, option.key]
                                );
                              }}
                              style={{ cursor: "pointer", border: "none", padding: "0.5rem 0.75rem", borderRadius: "999px" }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <label>Audit Verification Notes / Remarks</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Enter notes on credentials, blurry images, or LGU check updates..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="drawer-footer" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
                {isTargetAdmin ? (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", width: "100%", marginBottom: "0.5rem" }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)" }}>REQUESTED JURISDICTION BOUNDARY:</label>
                      <div style={{ background: "#f8fafc", padding: "0.6rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        📍 {selectedUser.requestedBarangayName || "Bucandala III"}, {selectedUser.requestedMunicipalityName || "Imus City"}, {selectedUser.requestedProvinceName || "Cavite"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", width: "100%" }}>
                      <button
                        className="btn btn-outline-danger flex-grow"
                        onClick={() => handleReject(selectedUser.uid)}
                      >
                        Reject Application
                      </button>
                      <button
                        className="btn btn-primary flex-grow"
                        onClick={handleAssignAdmin}
                      >
                        Approve & Assign
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "0.5rem", width: "100%" }}>
                      <button
                        className="btn btn-outline-navy flex-grow"
                        onClick={() => handleRequestResubmission(selectedUser.uid)}
                      >
                        Request Resubmission
                      </button>
                      <button
                        className="btn btn-outline-danger flex-grow"
                        onClick={() => handleReject(selectedUser.uid)}
                      >
                        Reject
                      </button>
                    </div>
                    <button
                      className="btn btn-primary w-100"
                      onClick={() => handleApprove(selectedUser, "youth")}
                    >
                      Approve & Verify Resident
                    </button>
                    {/* Admin override button for auto-rejected users */}
                    {isScopedOverrideCandidate(selectedUser) && (
                      <button
                        className="btn btn-success w-100"
                        style={{ marginTop: "0.5rem" }}
                        onClick={() => handleAdminOverride(selectedUser.uid)}
                      >
                        Approve (Override)
                      </button>
                    )}
                  </>
                )}
              </div>
            </aside>
          </>
        );
      })()}
      {/* ========================================================================= */}
      {/* 🔍 FULL-SCREEN INTERACTIVE IMAGE ZOOM LIGHTBOX MODAL */}
      {/* ========================================================================= */}
      {zoomImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            animation: "fadeIn 0.2s ease-in-out"
          }}
          onClick={() => { setZoomImage(null); setZoomLevel(1); setZoomRotation(0); }}
        >
          {/* Lightbox Controls Header */}
          <div
            style={{
              position: "absolute",
              top: "1.25rem",
              left: "1.5rem",
              right: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 10000,
              color: "#ffffff"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#ffffff" }}>
                {zoomImage.title}
              </h4>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Use controls below or press [Esc] key to exit inspection
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(30, 41, 59, 0.85)", padding: "0.5rem 1rem", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.15)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)" }}>
              <button
                className="btn btn-sm btn-outline-light"
                style={{ padding: "0.3rem 0.65rem", color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 4))}
                title="Zoom In (+25%)"
              >
                <ZoomIn size={15} /> +
              </button>

              <span style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: "monospace", minWidth: "50px", textAlign: "center", color: "#38bdf8" }}>
                {Math.round(zoomLevel * 100)}%
              </span>

              <button
                className="btn btn-sm btn-outline-light"
                style={{ padding: "0.3rem 0.65rem", color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                title="Zoom Out (-25%)"
              >
                <ZoomOut size={15} /> -
              </button>

              <button
                className="btn btn-sm btn-outline-light"
                style={{ padding: "0.3rem 0.65rem", color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                onClick={() => setZoomRotation(prev => (prev + 90) % 360)}
                title="Rotate Image 90°"
              >
                <RotateCw size={15} /> 90°
              </button>

              <button
                className="btn btn-sm btn-outline-light"
                style={{ padding: "0.3rem 0.65rem", color: "#ffffff", borderColor: "rgba(255,255,255,0.3)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                onClick={() => { setZoomLevel(1); setZoomRotation(0); }}
                title="Reset Zoom (100%)"
              >
                <Maximize2 size={15} /> Reset
              </button>

              <button
                style={{ background: "#ef4444", border: "none", color: "#ffffff", borderRadius: "8px", padding: "0.35rem 0.75rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", marginLeft: "0.5rem" }}
                onClick={() => { setZoomImage(null); setZoomLevel(1); setZoomRotation(0); }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scaled Image Viewport */}
          <div
            style={{
              flex: 1,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "auto",
              marginTop: "4.5rem"
            }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={zoomImage.url}
              alt={zoomImage.title}
              style={{
                maxWidth: "85vw",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: "12px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                transform: `scale(${zoomLevel}) rotate(${zoomRotation}deg)`,
                transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            />
          </div>
        </div>
      )}

      <ErrorValidationModal
        isOpen={panelError !== null}
        error={panelError}
        onClose={() => setPanelError(null)}
      />
    </div>
  );
};
