import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LoadingSpinner } from "../components/LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  allowGuest?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  allowGuest = false,
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Check guest state: only valid if there is NO authenticated user
  const isGuest = !user && localStorage.getItem("bgy_guest_mode") === "true";

  if (user && localStorage.getItem("bgy_guest_mode") === "true") {
    localStorage.removeItem("bgy_guest_mode");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <LoadingSpinner size="lg" label="Validating route permissions..." sublabel="Decentralized Identity Verification Active" />
      </div>
    );
  }

  // If user is guest and route allows guests
  if (isGuest && allowGuest) {
    return <>{children}</>;
  }

  // If not logged in and not guest
  if (!user && !isGuest) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user is onboarding / pending email
  if (user && profile) {
    if (profile.status === "pending_email_verification" && location.pathname !== "/auth") {
      return <Navigate to="/auth" replace />;
    }
  }

  // If role is restricted
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role || "viewer";
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
