import React, { useState } from "react";
import { verifyResident, verifySKOfficial } from "../transactions/transactions";
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
  const [targetAddress, setTargetAddress] = useState("");
  const [roleType, setRoleType] = useState<"youth" | "sk">("youth");
  const [verifyAction, setVerifyAction] = useState<"verify" | "unverify">("verify");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!targetAddress.startsWith("G") || targetAddress.length !== 56) {
      setErrorMsg("Invalid Stellar public key. Must start with 'G' and be 56 characters.");
      return;
    }

    const isVerify = verifyAction === "verify";

    onExecute((onStatusChange) => {
      if (roleType === "youth") {
        return verifyResident(adminAddress, targetAddress, isVerify, onStatusChange);
      } else {
        return verifySKOfficial(adminAddress, targetAddress, isVerify, onStatusChange);
      }
    });

    setTargetAddress("");
  };

  return (
    <div className="panel-card admin-panel">
      <h2 className="panel-title">Barangay Admin Dashboard</h2>
      <p className="panel-subtitle">Manage roles, verify residents, and authorize SK official accounts on-chain.</p>

      <form onSubmit={handleSubmit} className="panel-form">
        {errorMsg && <p className="form-error-msg">{errorMsg}</p>}

        <div className="form-group">
          <label htmlFor="target-address">Resident Public Key (G...)</label>
          <input
            id="target-address"
            type="text"
            className="form-control"
            placeholder="e.g. GDV44D7S6FDUT35QUOVE..."
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value.trim())}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group col">
            <label htmlFor="role-type">Access Role</label>
            <select
              id="role-type"
              className="form-control"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value as any)}
            >
              <option value="youth">Youth Resident (Voter)</option>
              <option value="sk">SK Official (Project Creator)</option>
            </select>
          </div>

          <div className="form-group col">
            <label htmlFor="verify-action">Action</label>
            <select
              id="verify-action"
              className="form-control"
              value={verifyAction}
              onChange={(e) => setVerifyAction(e.target.value as any)}
            >
              <option value="verify">Grant Verification</option>
              <option value="unverify">Revoke Verification</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-100">
          Execute Role Verification
        </button>
      </form>
    </div>
  );
};
