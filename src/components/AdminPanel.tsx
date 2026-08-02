import React, { useState } from "react";
import { verifyResident, verifySKOfficial } from "../transactions/transactions";
import { useAuth } from "../contexts/AuthContext";
import type { UserProfile } from "../contexts/AuthContext";
import type { TransactionStatus } from "../types";
import { ShieldCheck, UserCheck, X, AlertCircle } from "lucide-react";

interface AdminPanelProps {
  adminAddress: string;
  onExecute: (
    actionFn: (
      onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
    ) => Promise<string>
  ) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ adminAddress, onExecute }) => {
  const { dbUsers, verifyUserInDb } = useAuth();
  
  // Selected user for details drawer
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Filter out the admin themselves
  const pendingUsers = dbUsers.filter((u) => u.role !== "admin" && u.verificationStatus !== "approved");
  const approvedUsers = dbUsers.filter((u) => u.role !== "admin" && u.verificationStatus === "approved");
  
  const verifiedYouthCount = approvedUsers.filter(u => u.role === "youth").length;
  const verifiedSKCount = approvedUsers.filter(u => u.role === "sk").length;

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

  return (
    <div className="admin-dashboard-layout">
      {/* Verification dashboard metrics */}
      <div className="stats-row grid-3 mb-4">
        <div className="stats-card">
          <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <AlertCircle size={16} /> Pending Requests
          </span>
          <span className="stats-value">{pendingUsers.length}</span>
          <span className="stats-desc">Registrations requiring ID audits</span>
        </div>
        <div className="stats-card">
          <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <UserCheck size={16} /> Verified Youth
          </span>
          <span className="stats-value">{verifiedYouthCount}</span>
          <span className="stats-desc">Authorized voting residents</span>
        </div>
        <div className="stats-card">
          <span className="stats-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <ShieldCheck size={16} /> Verified SK Officials
          </span>
          <span className="stats-value">{verifiedSKCount}</span>
          <span className="stats-desc">Authorized project escrow creators</span>
        </div>
      </div>

      {/* Pending Verifications */}
      <div className="panel-card mb-4">
        <h2 className="panel-title">Pending Residency Verifications</h2>
        <p className="panel-subtitle">
          Click on any resident row to view identity files, calculate eligibility age, and register their public keys on-chain.
        </p>

        {pendingUsers.length === 0 ? (
          <div className="empty-panel-state">
            <p>No verification requests are currently awaiting audit.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Age Check</th>
                  <th>Barangay Location</th>
                  <th>Linked Wallet</th>
                  <th>Request Access</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u) => (
                  <tr 
                    key={u.uid} 
                    onClick={() => setSelectedUser(u)} 
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#475569", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}>
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <div className="font-bold">{u.name}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getAge(u.birthdate) >= 15 && getAge(u.birthdate) <= 30 ? "badge-success" : "badge-danger"}`}>
                        {getAge(u.birthdate)} yrs ({getAge(u.birthdate) >= 15 && getAge(u.birthdate) <= 30 ? "Eligible" : "Viewer Only"})
                      </span>
                    </td>
                    <td>{u.barangayName}</td>
                    <td>
                      {u.walletAddress ? (
                        <code className="wallet-address">{truncateAddress(u.walletAddress)}</code>
                      ) : (
                        <span className="badge badge-warning">Unlinked</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {u.requestedRole === "admin" ? "ADMIN" : u.requestedRole === "sk" ? "SK OFFICIAL" : "YOUTH RESIDENT"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approved Directory */}
      <div className="panel-card">
        <h2 className="panel-title">Verified Resident Registry</h2>
        <p className="panel-subtitle">Directory of active residents and officials verified on the Stellar Network.</p>

        {approvedUsers.length === 0 ? (
          <div className="empty-panel-state">
            <p>No verified users found in the registry.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Barangay Location</th>
                  <th>On-Chain Public Key</th>
                  <th>Role status</th>
                </tr>
              </thead>
              <tbody>
                {approvedUsers.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#475569", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}>
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <div className="font-bold">{u.name}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.barangayName}</td>
                    <td>
                      <code className="wallet-address" title={u.walletAddress || ""}>
                        {u.walletAddress ? truncateAddress(u.walletAddress) : "N/A"}
                      </code>
                    </td>
                    <td>
                      <span className={`badge ${u.role === "sk" ? "badge-warning" : u.role === "admin" ? "badge-info" : "badge-success"}`}>
                        {u.role === "sk" ? "SK Official" : u.role === "admin" ? "Barangay Admin" : "Youth Resident"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-out details drawer */}
      {selectedUser && (
        <>
          <div 
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)", zIndex: 199 }}
            onClick={() => setSelectedUser(null)}
          />
          <aside className="identity-detail-drawer" style={{ display: "flex", flexDirection: "column" }}>
            <div className="drawer-header">
              <h3 style={{ fontWeight: 800, color: "var(--text-primary)" }}>Resident ID Audit</h3>
              <button 
                onClick={() => setSelectedUser(null)} 
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body" style={{ flex: 1, overflowY: "auto", paddingRight: "0.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1rem 0" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#475569", border: "2px solid var(--role-accent)", fontSize: "1.5rem" }}>
                  {getInitials(selectedUser.name)}
                </div>
                <h4 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{selectedUser.name}</h4>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{selectedUser.email}</span>
              </div>

              {/* Duplicate Risk confidence indicator */}
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
                onClick={() => handleApprove(selectedUser, selectedUser.requestedRole === "sk" ? "sk" : "youth")}
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
