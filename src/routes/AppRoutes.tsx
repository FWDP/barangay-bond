import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { LandingView } from "../views/LandingView";
import { AuthPage } from "../views/auth/AuthPage";
import { MainLayout } from "../views/MainLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuth } from "../contexts/AuthContext";
import { useWallet } from "../contexts/WalletContext";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { VerifyEmailView } from "../views/auth/VerifyEmailView";
import { IdentityUploadView } from "../views/auth/IdentityUploadView";
import { SuspendedView } from "../views/auth/SuspendedView";
import { ExpiredNoticeView } from "../views/auth/ExpiredNoticeView";
import { VerificationLoadingTimeline } from "../components/VerificationTimeline";
import type { ResubmissionFieldKey, ResubmissionPresetKey } from "../utils/reviewDecision";
import { logger } from "../utils/logger";

interface AuthEntryContext {
  preset: ResubmissionPresetKey;
  fields: ResubmissionFieldKey[];
  startStep?: number;
}

export const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem("bgy_guest_mode") === "true";
  });
  const [authEntryContext, setAuthEntryContext] = useState<AuthEntryContext | null>(null);

  const { loading, user, profile, signOut, executeAIVerification } = useAuth();
  const { disconnect: disconnectWallet } = useWallet();

  const [isVerifyingPostEmail, setIsVerifyingPostEmail] = useState(false);
  const [tempIdPhoto, setTempIdPhoto] = useState("");
  const [tempSelfiePhoto, setTempSelfiePhoto] = useState("");
  const [tempProfilePhoto, setTempProfilePhoto] = useState("");

  // Sync isGuest with localStorage & user state
  useEffect(() => {
    if (user) {
      setIsGuest(false);
      localStorage.removeItem("bgy_guest_mode");
    } else if (isGuest) {
      localStorage.setItem("bgy_guest_mode", "true");
    } else {
      localStorage.removeItem("bgy_guest_mode");
    }
  }, [isGuest, user]);

  const effectiveIsGuest = !user && isGuest;

  // Log route transitions
  useEffect(() => {
    logger.ui(`Navigated to route: ${location.pathname} (Guest = ${effectiveIsGuest})`, "AppRouter");
  }, [location.pathname, effectiveIsGuest]);

  const handleLogout = async () => {
    try {
      disconnectWallet();
    } catch (e) {
      console.error("Wallet disconnect failed:", e);
    }
    await signOut();
    setIsGuest(false);
    localStorage.removeItem("bgy_guest_mode");
    navigate("/");
  };

  const handleRequestResubmission = (context: AuthEntryContext) => {
    setAuthEntryContext(context);
    navigate("/auth");
  };

  // If loading user state from firebase
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <LoadingSpinner size="lg" label="Restoring profile identity session..." sublabel="Decentralized Identity Verification Active" />
      </div>
    );
  }

  // Handle Authentication Gate for Incomplete Profiles
  if (user && !isGuest) {
    if (!profile) {
      if (!user.emailVerified) {
        return <VerifyEmailView profile={null} onLogout={handleLogout} />;
      }
    } else {
      if (profile.status === "pending_email_verification") {
        return <VerifyEmailView profile={profile} onLogout={handleLogout} />;
      }

      if (profile.status === "suspended") {
        return <SuspendedView profile={profile} onLogout={handleLogout} />;
      }

      if (profile.status === "expired") {
        return <ExpiredNoticeView profile={profile} onLogout={handleLogout} />;
      }

      if (profile.role !== "system_admin" && (profile.idPhotoUrl === "N/A" || !profile.idPhotoUrl)) {
        if (isVerifyingPostEmail) {
          return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: "2rem" }}>
              <div style={{ maxWidth: "560px", width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-glass)", borderRadius: "24px", padding: "3rem 2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)" }}>
                <VerificationLoadingTimeline
                  desiredRole={profile.requestedRole || "resident"}
                  email={profile.email}
                  barangayName={profile.barangayName}
                  runSignUp={async () => {
                    return await executeAIVerification(tempIdPhoto, tempSelfiePhoto, tempProfilePhoto, profile);
                  }}
                  onComplete={() => {
                    setIsVerifyingPostEmail(false);
                    navigate("/dashboard");
                  }}
                  onCancel={() => {
                    setIsVerifyingPostEmail(false);
                  }}
                />
              </div>
            </div>
          );
        }

        return (
          <IdentityUploadView
            profile={profile}
            onUploadComplete={(idUrl, selfieUrl, avatarUrl) => {
              setTempIdPhoto(idUrl);
              setTempSelfiePhoto(selfieUrl);
              setTempProfilePhoto(avatarUrl);
              setIsVerifyingPostEmail(true);
            }}
            onLogout={handleLogout}
          />
        );
      }
    }
  }

  return (
    <Routes>
      {/* 1. PUBLIC LANDING PAGE */}
      <Route
        path="/"
        element={
          <LandingView
            setViewState={(view) => {
              if (view === "auth") navigate("/auth");
              else if (view === "dashboard") navigate("/dashboard");
            }}
            setIsGuest={(guest) => {
              setIsGuest(guest);
              if (guest) navigate("/dashboard");
            }}
          />
        }
      />

      {/* 2. AUTHENTICATION & REGISTRATION PORTAL */}
      <Route
        path="/auth"
        element={
          <AuthPage
            setViewState={(view) => {
              if (view === "dashboard") navigate("/dashboard");
              else if (view === "landing") navigate("/");
            }}
            authEntryContext={authEntryContext}
            setAuthEntryContext={setAuthEntryContext}
          />
        }
      />

      {/* 3. GUEST EXPLORER SHORTCUT */}
      <Route
        path="/guest"
        element={
          <GuestRedirector
            onSetGuest={() => {
              setIsGuest(true);
              navigate("/dashboard", { replace: true });
            }}
          />
        }
      />

      {/* 4. MAIN CIVIC PLATFORM WORKSPACES */}
      {/* TAB 1: HOME */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowGuest={true}>
            <MainLayout
              setViewState={(view) => {
                if (view === "auth") navigate("/auth");
                else if (view === "landing") handleLogout();
              }}
              isGuest={effectiveIsGuest}
              setIsGuest={setIsGuest}
              onRequestResubmission={handleRequestResubmission}
            />
          </ProtectedRoute>
        }
      />
      <Route path="/home" element={<Navigate to="/dashboard" replace />} />

      {/* TAB 2: PROJECTS (CIVIC VOTING & EXPLORER) */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute allowGuest={true}>
            <MainLayout
              setViewState={(view) => {
                if (view === "auth") navigate("/auth");
                else if (view === "landing") handleLogout();
              }}
              isGuest={effectiveIsGuest}
              setIsGuest={setIsGuest}
              onRequestResubmission={handleRequestResubmission}
            />
          </ProtectedRoute>
        }
      />
      <Route path="/voting" element={<Navigate to="/projects" replace />} />

      {/* TAB 3: LEDGER (REDIRECT TO UNIFIED PROJECTS) */}
      <Route path="/ledger" element={<Navigate to="/projects" replace />} />

      {/* TAB 4: ACTIVITY (MERGED ALERTS & WALLET TRANSACTIONS) */}
      <Route
        path="/activity"
        element={
          <ProtectedRoute allowGuest={false}>
            <MainLayout
              setViewState={(view) => {
                if (view === "auth") navigate("/auth");
                else if (view === "landing") handleLogout();
              }}
              isGuest={effectiveIsGuest}
              setIsGuest={setIsGuest}
              onRequestResubmission={handleRequestResubmission}
            />
          </ProtectedRoute>
        }
      />
      <Route path="/notifications" element={<Navigate to="/activity" replace />} />

      {/* TAB 5: PROFILE & ROLE-GATED WORKSPACES */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowGuest={false}>
            <MainLayout
              setViewState={(view) => {
                if (view === "auth") navigate("/auth");
                else if (view === "landing") handleLogout();
              }}
              isGuest={effectiveIsGuest}
              setIsGuest={setIsGuest}
              onRequestResubmission={handleRequestResubmission}
            />
          </ProtectedRoute>
        }
      />

      {/* ROLE WORKSPACE: SK PROPOSAL & DELIVERABLES STUDIO */}
      <Route
        path="/studio"
        element={
          <ProtectedRoute allowedRoles={["sk_official"]} allowGuest={false}>
            <MainLayout
              setViewState={(view) => {
                if (view === "auth") navigate("/auth");
                else if (view === "landing") handleLogout();
              }}
              isGuest={effectiveIsGuest}
              setIsGuest={setIsGuest}
              onRequestResubmission={handleRequestResubmission}
            />
          </ProtectedRoute>
        }
      />

      {/* ROLE WORKSPACE: BARANGAY & SYSTEM ADMIN DESK */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["barangay_admin", "system_admin"]} allowGuest={false}>
            <MainLayout
              setViewState={(view) => {
                if (view === "auth") navigate("/auth");
                else if (view === "landing") handleLogout();
              }}
              isGuest={effectiveIsGuest}
              setIsGuest={setIsGuest}
              onRequestResubmission={handleRequestResubmission}
            />
          </ProtectedRoute>
        }
      />

      {/* 5. CATCH-ALL REDIRECT */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const GuestRedirector: React.FC<{ onSetGuest: () => void }> = ({ onSetGuest }) => {
  useEffect(() => {
    onSetGuest();
  }, [onSetGuest]);
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
      <LoadingSpinner size="lg" label="Entering Public Auditor Mode..." />
    </div>
  );
};

export default AppRoutes;
