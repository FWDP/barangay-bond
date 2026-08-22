import React from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";

interface LoginStepProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  onNext: () => void;
}

export const LoginStep: React.FC<LoginStepProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  onNext
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Mail size={14} style={{ color: "var(--role-accent)" }} /> Email Address
        </label>
        <input
          type="email"
          inputMode="email"
          className="form-control"
          placeholder="your.email@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Lock size={14} style={{ color: "var(--role-accent)" }} /> Password
        </label>
        <input
          type="password"
          className="form-control"
          placeholder="•••••••• (Min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg w-100"
        style={{ marginTop: "0.75rem", width: "100%", height: "54px" }}
        disabled={loading}
        onClick={onNext}
      >
        {loading ? (
          "Creating Secure Account..."
        ) : (
          <>
            Register & Send Link <ArrowRight size={18} />
          </>
        )}
      </button>
    </div>
  );
};

export default LoginStep;
