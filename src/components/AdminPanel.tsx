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

  // Filter out the admin themselves
  const pendingUsers = dbUsers.filter((u) => u.role !== "admin" && u.verificationStatus !== "approved");
  const approvedUsers = dbUsers.filter((u) => u.role !== "admin" && u.verificationStatus === "approved");
  
  const verifiedYouthCount = approvedUsers.filter(u => u.role === "youth").length;
  const verifiedSKCount = approvedUsers.filter(u => u.role === "sk").length;

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

      await verifyUserInDb(user.uid, role, true);
      setSelectedUser(null);
      return txHash;
    });
  };

  const handleReject = async (uid: string) => {
    if (confirm("Are you sure you want to reject this verification request?")) {
      try {
        await verifyUserInDb(uid, "youth", false);
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
          <aside className="identity-detail-drawer">
            <div className="drawer-header">
              <h3 style={{ fontWeight: 800, color: "var(--text-primary)" }}>Resident ID Audit</h3>
              <button 
                onClick={() => setSelectedUser(null)} 
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1rem 0" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#475569", border: "2px solid var(--role-accent)", fontSize: "1.5rem" }}>
                  {getInitials(selectedUser.name)}
                </div>
                <h4 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{selectedUser.name}</h4>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{selectedUser.email}</span>
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
