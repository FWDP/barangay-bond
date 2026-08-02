import React, { useState, useEffect } from "react";
import { verifyResident, verifySKOfficial } from "../transactions/transactions";
import { useAuth } from "../contexts/AuthContext";
import type { UserProfile, Barangay } from "../contexts/AuthContext";
import type { TransactionStatus } from "../types";
import { db } from "../services/firebase";
import { collection, query, getDocs, orderBy, addDoc } from "firebase/firestore";
import { 
  ShieldCheck, UserCheck, X, AlertCircle, Award, Ban, 
  UserX, FileText, CheckCircle2, History, Radio, RefreshCw 
} from "lucide-react";

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
    lockProfileForReview, 
    proposeBarangay, 
    approveBarangay, 
    getAllBarangays 
  } = useAuth();
  
  // Dialog / Drawer states
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Audit Logs and Barangay States
  const [logs, setLogs] = useState<any[]>([]);
  const [allBarangays, setAllBarangays] = useState<Barangay[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Form input states
  const [newBgyName, setNewBgyName] = useState("");
  const [newBgyMunicipality, setNewBgyMunicipality] = useState("");
  const [newBgyProvince, setNewBgyProvince] = useState("");

  const [selectedAdminForAssign, setSelectedAdminForAssign] = useState<UserProfile | null>(null);
  const [assignBarangayId, setAssignBarangayId] = useState("");

  const [selectedResidentForSK, setSelectedResidentForSK] = useState<UserProfile | null>(null);
  const [skPosition, setSkPosition] = useState<"chairman" | "kagawad" | "secretary" | "treasurer">("chairman");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [skError, setSkError] = useState("");

  const [logsFilterCategory, setLogsFilterCategory] = useState("");
  const [logsFilterSeverity, setLogsFilterSeverity] = useState("");

  // Fetch audit records and LGUs
  const loadLogsAndBarangays = async () => {
    setLoadingLogs(true);
    try {
      const list = await getAllBarangays();
      setAllBarangays(list);

      const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const logList: any[] = [];
      snap.forEach((docSnap) => {
        logList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLogs(logList);
    } catch (err) {
      console.error("Failed to load LGU audit records:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogsAndBarangays();
  }, [dbUsers]);

  const handleProposeBarangay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBgyName.trim() || !newBgyMunicipality.trim() || !newBgyProvince.trim()) return;
    try {
      await proposeBarangay(newBgyName.trim(), newBgyMunicipality.trim(), newBgyProvince.trim());
      setNewBgyName("");
      setNewBgyMunicipality("");
      setNewBgyProvince("");
      alert("Barangay proposal submitted successfully for System Admin review.");
      await loadLogsAndBarangays();
    } catch (err: any) {
      alert("Failed to propose LGU: " + err.message);
    }
  };

  const handleApproveBarangay = async (id: string) => {
    try {
      await approveBarangay(id);
      alert("Barangay approved successfully. It can now register residents and assign admins.");
      await loadLogsAndBarangays();
    } catch (err: any) {
      alert("Failed to approve Barangay: " + err.message);
    }
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminForAssign || !assignBarangayId) return;
    const targetBgy = allBarangays.find(b => b.id === assignBarangayId);
    if (!targetBgy) return;

    try {
      await approveBarangayAdmin(selectedAdminForAssign.uid, assignBarangayId, targetBgy.name);
      alert(`Approved ${selectedAdminForAssign.name} as admin for Barangay ${targetBgy.name}.`);
      setSelectedAdminForAssign(null);
      setAssignBarangayId("");
    } catch (err: any) {
      alert("Failed to assign Barangay Admin: " + err.message);
    }
  };

  const handleSuspendAdmin = async (uid: string, isSuspend: boolean) => {
    if (confirm(`Are you sure you want to ${isSuspend ? "SUSPEND" : "REACTIVATE"} this Barangay Admin?`)) {
      try {
        await suspendBarangayAdmin(uid, isSuspend);
        alert(`Admin status successfully changed to ${isSuspend ? "SUSPENDED" : "ACTIVE"}.`);
      } catch (err: any) {
        alert("Failed to toggle admin status: " + err.message);
      }
    }
  };

  const handlePromoteSK = async (e: React.FormEvent) => {
    e.preventDefault();
    setSkError("");
    if (!selectedResidentForSK || !termStart || !termEnd) return;

    try {
      await assignSKOfficial(selectedResidentForSK.uid, skPosition, termStart, termEnd);
      alert(`Resident successfully promoted to active SK ${skPosition}.`);
      setSelectedResidentForSK(null);
      setTermStart("");
      setTermEnd("");
    } catch (err: any) {
      setSkError(err.message || "Failed to promote resident to SK position.");
    }
  };

  const handleRevokeSK = async (uid: string) => {
    if (confirm("Are you sure you want to revoke this SK Official's term and restore them to resident status?")) {
      try {
        await revokeSKOfficial(uid);
        alert("SK term revoked successfully.");
      } catch (err: any) {
        alert("Failed to revoke term: " + err.message);
      }
    }
  };

  const handleOpenReview = async (user: UserProfile) => {
    setSelectedUser(user);
    setAdminNotes(user.verificationNotes || "");
    try {
      await lockProfileForReview(user.uid, true);
    } catch (err) {
      console.error("Failed to write lock:", err);
    }
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
    setAdminNotes("");
  };

  const handleApprove = (user: UserProfile, role: "sk" | "youth") => {
    if (!user.walletAddress) {
      alert("This resident has not linked their Stellar wallet address yet.");
      return;
    }

    onExecute(async (onStatusChange) => {
      let txHash = "";
      if (role === "youth") {
        txHash = await verifyResident(adminAddress, user.walletAddress!, true, onStatusChange);
      } else {
        txHash = await verifySKOfficial(adminAddress, user.walletAddress!, true, onStatusChange);
      }

      await verifyUserInDb(user.uid, role, true, adminNotes || "Approved by Admin");
      setAdminNotes("");
      setSelectedUser(null);
      return txHash;
    });
  };

  const handleReject = async (uid: string) => {
    if (confirm("Are you sure you want to reject this verification request?")) {
      try {
        await verifyUserInDb(uid, "youth", false, adminNotes || "Rejected by Admin");
        setAdminNotes("");
        setSelectedUser(null);
      } catch (err: any) {
        alert("Failed to update user: " + err.message);
      }
    }
  };

  const getDuplicateRisk = (user: UserProfile) => {
    if (!user) return { level: "Low", text: "🟢 Low Risk", color: "badge-success", reasons: [] as string[] };
    const others = dbUsers.filter(u => u.uid !== user.uid);
    let highMatch = false;
    let possibleMatch = false;
    let matchReasons: string[] = [];

    others.forEach(u => {
      if (u.idNumber && u.idNumber === user.idNumber) {
        highMatch = true;
        matchReasons.push(`ID Number match: ${user.idNumber}`);
      }
      if (u.mobileNumber && u.mobileNumber === user.mobileNumber) {
        highMatch = true;
        matchReasons.push(`Mobile number match: ${user.mobileNumber}`);
      }
      if (u.walletAddress && u.walletAddress === user.walletAddress) {
        highMatch = true;
        matchReasons.push("Linked wallet match");
      }
      if (u.name.toLowerCase() === user.name.toLowerCase()) {
        possibleMatch = true;
        matchReasons.push(`Exact Name match: ${user.name}`);
      }
      if (u.address && user.address && u.address.toLowerCase() === user.address.toLowerCase()) {
        possibleMatch = true;
        matchReasons.push("Same address matches");
      }
    });

    if (highMatch) {
      return { level: "High", text: "🔴 High Risk Duplicate", color: "badge-danger", reasons: matchReasons };
    }
    if (possibleMatch) {
      return { level: "Possible", text: "🟡 Possible Duplicate", color: "badge-warning", reasons: matchReasons };
    }
    return { level: "Low", text: "🟢 Low Risk", color: "badge-success", reasons: [] as string[] };
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

  // Scoped stats filters
  const pendingAdmins = dbUsers.filter(u => u.role === "barangay_admin" && u.verificationStatus === "pending");
  const activeAdmins = dbUsers.filter(u => u.role === "barangay_admin" && u.verificationStatus === "approved");

  const pendingResidents = dbUsers.filter(
    u => u.role === "resident" && 
    u.verificationStatus === "pending" && 
    (isSysAdmin || u.barangayId === profile?.barangayId)
  );

  const activeResidents = dbUsers.filter(
    u => u.role === "resident" && 
    u.verificationStatus === "approved" && 
    (isSysAdmin || u.barangayId === profile?.barangayId)
  );

  const activeSKOfficials = dbUsers.filter(
    u => u.role === "sk_official" && 
    u.status === "active" && 
    (isSysAdmin || u.barangayId === profile?.barangayId)
  );

  return (
    <div className="admin-dashboard-layout" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* ========================================================================= */}
      {/* 🛠️ PLATFORM SYSTEM ADMIN CONSOLE */}
      {/* ========================================================================= */}
      {isSysAdmin && (
        <>
          <div className="stats-row grid-4 mb-4">
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Radio size={16} /> Total Barangays
              </span>
              <span className="stats-value">{allBarangays.length}</span>
              <span className="stats-desc">Proposed & approved LGUs</span>
            </div>
            <div className="stats-card">
              <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <AlertCircle size={16} /> Pending Admins
              </span>
              <span className="stats-value">{pendingAdmins.length}</span>
              <span className="stats-desc">Awaiting Barangay assignment</span>
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

          <div className="grid-2">
            {/* Propose & Approve Barangays */}
            <div className="panel-card">
              <h2 className="panel-title">LGU Barangay Registry</h2>
              <p className="panel-subtitle">Propose new participating barangays or activate pending applications.</p>
              
              <form onSubmit={handleProposeBarangay} className="panel-form mb-4" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: "1.5rem" }}>
                <input 
                  type="text" 
                  className="form-control flex-grow" 
                  placeholder="Barangay Name" 
                  value={newBgyName} 
                  onChange={e => setNewBgyName(e.target.value)} 
                  required 
                />
                <input 
                  type="text" 
                  className="form-control flex-grow" 
                  placeholder="Municipality" 
                  value={newBgyMunicipality} 
                  onChange={e => setNewBgyMunicipality(e.target.value)} 
                  required 
                />
                <input 
                  type="text" 
                  className="form-control flex-grow" 
                  placeholder="Province" 
                  value={newBgyProvince} 
                  onChange={e => setNewBgyProvince(e.target.value)} 
                  required 
                />
                <button type="submit" className="btn btn-primary">Propose LGU</button>
              </form>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>LGU Location</th>
                      <th>Status</th>
                      <th>Admins / Residents</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBarangays.map(b => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.name}</strong>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{b.municipality}, {b.province}</div>
                        </td>
                        <td>
                          <span className={`badge ${b.status === "approved" ? "badge-success" : "badge-warning"}`}>
                            {b.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "0.85rem" }}>Admins: {b.adminsCount || 0} | Residents: {b.residentsCount || 0}</span>
                        </td>
                        <td>
                          {b.status === "pending" && (
                            <button className="btn btn-sm btn-success" onClick={() => handleApproveBarangay(b.id)}>
                              Approve LGU
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Barangay Admin Approval Queue */}
            <div className="panel-card">
              <h2 className="panel-title">Pending Barangay Admins Queue</h2>
              <p className="panel-subtitle">Approve pending applications and assign them to an active Barangay.</p>

              {pendingAdmins.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                  <CheckCircle2 size={36} style={{ color: "#10b981", margin: "0 auto 1rem auto" }} />
                  <p>All admin applications have been assigned and activated.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Admin Candidate</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingAdmins.map(adm => (
                        <tr key={adm.uid}>
                          <td>
                            <strong>{adm.name}</strong>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{adm.email}</div>
                          </td>
                          <td>
                            <button className="btn btn-sm btn-primary" onClick={() => setSelectedAdminForAssign(adm)}>
                              Review & Assign
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Assign Barangay Admin Modal Drawer */}
              {selectedAdminForAssign && (
                <div style={{ borderTop: "2px solid var(--primary)", marginTop: "1.5rem", paddingTop: "1rem" }}>
                  <h4>Assign Barangay Boundary for {selectedAdminForAssign.name}</h4>
                  <form onSubmit={handleAssignAdmin} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <select 
                      className="form-control flex-grow" 
                      value={assignBarangayId} 
                      onChange={e => setAssignBarangayId(e.target.value)} 
                      required
                    >
                      <option value="">-- Select Active Barangay --</option>
                      {allBarangays.filter(b => b.status === "approved").map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.municipality})</option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn-success">Approve & Assign</button>
                    <button type="button" className="btn btn-outline-danger" onClick={() => setSelectedAdminForAssign(null)}>Cancel</button>
                  </form>
                </div>
              )}
            </div>
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
        </>
      )}

      {/* ========================================================================= */}
      {/* 📁 RESIDENT VERIFICATION DRAWER */}
      {/* ========================================================================= */}
      {selectedUser && (
        <>
          <div 
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)", zIndex: 199 }}
            onClick={handleCloseReview}
          />
          <aside className="identity-detail-drawer" style={{ display: "flex", flexDirection: "column" }}>
            <div className="drawer-header">
              <h3 style={{ fontWeight: 800, color: "var(--text-primary)" }}>Resident ID Audit</h3>
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
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#475569", border: "2px solid var(--role-accent)", fontSize: "1.5rem" }}>
                  {getInitials(selectedUser.name)}
                </div>
                <h4 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{selectedUser.name}</h4>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{selectedUser.email}</span>
              </div>

              {/* Duplicate Risk indicator */}
              <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1rem", marginBottom: "1.2rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>Duplicate Confidence Check</span>
                {(() => {
                  const risk = getDuplicateRisk(selectedUser);
                  return (
                    <>
                      <span className={`badge ${risk.color}`} style={{ width: "max-content", padding: "0.3rem 0.6rem" }}>
                        {risk.text}
                      </span>
                      {risk.reasons.length > 0 && (
                        <div style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                          Reasons: {risk.reasons.join(", ")}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Desired Role:</span>
                  <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{selectedUser.requestedRole}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Barangay Location:</span>
                  <span style={{ fontWeight: 700 }}>{selectedUser.barangayName}</span>
                </div>
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
                {selectedUser.idPhotoUrl && selectedUser.idPhotoUrl !== "N/A" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Uploaded ID Document Photo:</span>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", width: "100%", height: "160px" }}>
                      <img src={selectedUser.idPhotoUrl} alt="LGU Verified ID" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Stellar Public Address:</span>
                  {selectedUser.walletAddress ? (
                    <code style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                      {selectedUser.walletAddress}
                    </code>
                  ) : (
                    <span style={{ color: "#ef4444", fontSize: "0.85rem", fontWeight: 600 }}>Resident hasn't linked a Stellar Wallet key.</span>
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

            <div className="drawer-footer">
              <button 
                className="btn btn-outline-danger flex-grow"
                onClick={() => handleReject(selectedUser.uid)}
              >
                Reject Request
              </button>
              <button 
                className="btn btn-primary flex-grow"
                disabled={!selectedUser.walletAddress}
                onClick={() => handleApprove(selectedUser, selectedUser.requestedRole === "sk_official" ? "sk" : "youth")}
              >
                Approve & Verify
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};
