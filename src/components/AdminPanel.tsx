import React from "react";
import { verifyResident, verifySKOfficial } from "../transactions/transactions";
import { useAuth } from "../contexts/AuthContext";
import type { UserProfile } from "../contexts/AuthContext";
import type { TransactionStatus } from "../types";

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

  // Filter out the admin themselves
  const pendingUsers = dbUsers.filter((u) => u.role !== "admin" && u.verificationStatus !== "approved");
  const approvedUsers = dbUsers.filter((u) => u.role !== "admin" && u.verificationStatus === "approved");

  const handleApprove = (user: UserProfile, role: "sk" | "youth") => {
    if (!user.walletAddress) {
      alert("This user has not linked their Stellar wallet address yet.");
      return;
    }

    onExecute(async (onStatusChange) => {
      // 1. Submit on-chain Soroban contract transaction to verify address
      let txHash = "";
      if (role === "youth") {
        txHash = await verifyResident(adminAddress, user.walletAddress!, true, onStatusChange);
      } else {
        txHash = await verifySKOfficial(adminAddress, user.walletAddress!, true, onStatusChange);
      }

      // 2. Update Web2 Firestore Database verification role state
      await verifyUserInDb(user.uid, role, true);
      return txHash;
    });
  };

  const handleReject = async (uid: string) => {
    if (confirm("Are you sure you want to reject this verification request?")) {
      try {
        await verifyUserInDb(uid, "youth", false);
      } catch (err: any) {
        alert("Failed to update user: " + err.message);
      }
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <div className="admin-dashboard-layout">
      {/* Pending Verifications */}
      <div className="panel-card mb-4">
        <h2 className="panel-title">Pending Residency Verifications</h2>
        <p className="panel-subtitle">
          Verify registered resident credentials and bind their public addresses on-chain.
        </p>

        {pendingUsers.length === 0 ? (
          <div className="empty-panel-state">
            <p>No pending verification requests are currently active.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Birthdate</th>
                  <th>Barangay</th>
                  <th>Linked Wallet</th>
                  <th>Desired Access</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="font-bold">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.birthdate}</td>
                    <td>{u.barangay}</td>
                    <td>
                      {u.walletAddress ? (
                        <code className="wallet-address" title={u.walletAddress}>
                          {truncateAddress(u.walletAddress)}
                        </code>
                      ) : (
                        <span className="badge badge-warning">Unlinked</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.role === "viewer" ? "badge-info" : "badge-warning"}`}>
                        {u.role === "viewer" ? "Youth/SK Request" : u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="admin-action-buttons">
                        <button
                          className="btn btn-success btn-sm"
                          disabled={!u.walletAddress}
                          onClick={() => handleApprove(u, "youth")}
                        >
                          Approve Youth
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!u.walletAddress}
                          style={{ marginLeft: "0.25rem" }}
                          onClick={() => handleApprove(u, "sk")}
                        >
                          Approve SK
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          style={{ marginLeft: "0.25rem" }}
                          onClick={() => handleReject(u.uid)}
                        >
                          Reject
                        </button>
                      </div>
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
                  <th>Name</th>
                  <th>Email</th>
                  <th>Barangay</th>
                  <th>On-Chain Address</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="font-bold">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.barangay}</td>
                    <td>
                      <code className="wallet-address" title={u.walletAddress || ""}>
                        {u.walletAddress ? truncateAddress(u.walletAddress) : "N/A"}
                      </code>
                    </td>
                    <td>
                      <span className={`badge ${u.role === "sk" ? "badge-warning" : "badge-success"}`}>
                        {u.role === "sk" ? "SK Official" : "Youth Resident"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success">On-Chain Verified</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
