import React, { useState, useEffect } from "react";
import { LoadingProvider } from "./contexts/LoadingContext";
import { UniversalLoadingOverlay } from "./components/UniversalLoadingOverlay";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WalletProvider, useWallet } from "./contexts/WalletContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DevConsole } from "./components/DevConsole";
import { LandingView } from "./views/LandingView";
import { AuthPage } from "./views/auth/AuthPage";
import { MainLayout } from "./views/MainLayout";
import { SuspendedView } from "./views/auth/SuspendedView";
import { ExpiredNoticeView } from "./views/auth/ExpiredNoticeView";
import { IdentityUploadView } from "./views/auth/IdentityUploadView";
import { VerifyEmailView } from "./views/auth/VerifyEmailView";
import { VerificationLoadingTimeline } from "./components/VerificationTimeline";
import { LoadingSpinner } from "./components/LoadingSpinner";
import type { ResubmissionFieldKey, ResubmissionPresetKey } from "./utils/reviewDecision";
import { logger } from "./utils/logger";

type ViewState = "landing" | "auth" | "dashboard";

interface AuthEntryContext {
  preset: ResubmissionPresetKey;
  fields: ResubmissionFieldKey[];
  startStep?: number;
}

const AppController: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>("landing");
  const [isGuest, setIsGuest] = useState(false);
  const [authEntryContext, setAuthEntryContext] = useState<AuthEntryContext | null>(null);

  const { loading, user, profile, signOut, executeAIVerification } = useAuth();
  const { disconnect: disconnectWallet } = useWallet();

  const [isVerifyingPostEmail, setIsVerifyingPostEmail] = useState(false);
  const [tempIdPhoto, setTempIdPhoto] = useState("");
  const [tempSelfiePhoto, setTempSelfiePhoto] = useState("");
  const [tempProfilePhoto, setTempProfilePhoto] = useState("");

  // Log route transitions and authorizations
  useEffect(() => {
    logger.ui(`Route transition: navigating to view = ${viewState.toUpperCase()} (Guest Mode = ${isGuest})`, "AppController");
  }, [viewState, isGuest]);

  const handleLogout = async () => {
    try {
      disconnectWallet();
    } catch (e) {
      console.error("Wallet disconnect on logout failed:", e);
    }
    await signOut();
    setIsGuest(false);
    setViewState("landing");
  };

  const handleRequestResubmission = (context: AuthEntryContext) => {
    setAuthEntryContext(context);
    setViewState("auth");
  };

  useEffect(() => {
    if (viewState !== "auth" && authEntryContext) {
      setAuthEntryContext(null);
    }
  }, [viewState, authEntryContext]);

  // If loading user state from firebase
  if (loading) {
    return (
      <div className="full-height-spinner">
        <LoadingSpinner size="lg" label="Restoring profile identity session..." />
      </div>
    );
  }

  const isAuthOnlyReview = profile && ["pending_email_verification", "onboarding"].includes(profile.status);
  const isDashboardEligible = user && profile && !isAuthOnlyReview;

  if (user && viewState === "landing" && isDashboardEligible) {
    setViewState("dashboard");
  }

  if (user && viewState === "auth" && isDashboardEligible && !authEntryContext) {
    setViewState("dashboard");
  }

  // Authentication Gate Status Checks for Logged In users
  if (user && !isGuest) {
    if (!profile) {
      if (!user.emailVerified) {
        return <VerifyEmailView profile={null} onLogout={handleLogout} />;
      } else {
        if (viewState !== "auth") {
          setViewState("auth");
        }
      }
    } else {
      if (profile.status === "pending_email_verification") {
        return <VerifyEmailView profile={profile} onLogout={handleLogout} />;
      }

      if (profile.status === "onboarding") {
        if (viewState !== "auth") {
          setViewState("auth");
        }
      }
    }
  }

  if (user && !isGuest && viewState === "dashboard") {
    if (!profile) {
      return (
        <div className="full-height-spinner">
          <LoadingSpinner size="lg" label="Loading profile configuration..." />
        </div>
      );
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
                  setViewState("dashboard");
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

    // Suspended and Expired accounts are routed to locked full-screens
    if (profile.status === "suspended") {
      return <SuspendedView profile={profile} onLogout={handleLogout} />;
    }
    if (profile.status === "expired") {
      return <ExpiredNoticeView profile={profile} onLogout={handleLogout} />;
    }
  }

  switch (viewState) {
    case "landing":
      return <LandingView setViewState={setViewState} setIsGuest={setIsGuest} />;
    case "auth":
      return <AuthPage setViewState={setViewState} authEntryContext={authEntryContext} setAuthEntryContext={setAuthEntryContext} />;
    case "dashboard":
      if (!user && !isGuest) {
        setViewState("landing");
        return null;
      }
      return (
        <MainLayout
          setViewState={setViewState}
          isGuest={isGuest}
          setIsGuest={setIsGuest}
          onRequestResubmission={handleRequestResubmission}
        />
      );
    default:
      return null;
  }
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LoadingProvider>
          <AuthProvider>
            <WalletProvider>
              <AppController />
              <UniversalLoadingOverlay />
              <DevConsole />
            </WalletProvider>
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
