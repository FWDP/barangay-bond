import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { logger } from "../utils/logger";
import { getFuzzySimilarity } from "../services/gemini";
import { userRepository } from "../repositories/user.repository";
import { AlertTriangle } from "lucide-react";

interface VerificationTimelineProps {
  desiredRole: string;
  email: string;
  barangayName: string;
  runSignUp: () => Promise<any>;
  onComplete: (profile: any) => void;
  onCancel: () => void;
}

export const VerificationLoadingTimeline: React.FC<VerificationTimelineProps> = ({
  desiredRole,
  email: _email,
  barangayName: _barangayName,
  runSignUp,
  onComplete,
  onCancel
}) => {
  const [stages, setStages] = useState<any[]>([
    { id: "account", label: "Creating Barangay Bond account...", status: "pending" },
    { id: "compress", label: "Compressing uploaded documents...", status: "pending" },
    { id: "upload_id", label: "Uploading government ID...", status: "pending" },
    { id: "upload_selfie", label: "Uploading selfie verification...", status: "pending" },
    { id: "security", label: "Running security validation...", status: "pending" },
    { id: "duplicate", label: "Checking duplicate registrations...", status: "pending" },
    { id: "compare", label: "Comparing submitted information...", status: "pending" },
    { id: "ai_read", label: "AI reading government ID...", status: "pending" },
    { id: "ai_address", label: "AI validating barangay address...", status: "pending" },
    { id: "ai_identity", label: "AI validating identity...", status: "pending" },
    { id: "confidence", label: "Calculating verification confidence...", status: "pending" },
    { id: "package", label: "Preparing review package...", status: "pending" },
    { id: "submit", label: "Submitting application...", status: "pending" }
  ]);

  const [progressScores, setProgressScores] = useState({
    idCard: 0,
    quality: 0,
    identity: 0,
    address: 0,
    duplicate: 0,
    fraud: 0
  });

  const { profile } = useAuth();
  const [signupResult, setSignupResult] = useState<any | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [selectedCorrections, setSelectedCorrections] = useState<string[]>([]);
  const [applyingCorrections, setApplyingCorrections] = useState(false);

  useEffect(() => {
    let isActive = true;
    let progressTimer: any;
    let promiseResolved = false;
    let resolvedProfile: any = null;
    let resolvedError: any = null;

    runSignUp()
      .then((profile) => {
        promiseResolved = true;
        resolvedProfile = profile;
        logger.info("[Timeline] Background signup promise resolved", "Timeline");
      })
      .catch((err) => {
        promiseResolved = true;
        resolvedError = err;
        logger.error(`[Timeline] Background signup promise failed: ${err.message}`, "Timeline");
      });

    progressTimer = setInterval(() => {
      if (!isActive) return;
      setProgressScores((prev) => {
        if (signupResult) return prev;
        return {
          idCard: Math.min(prev.idCard + Math.floor(Math.random() * 8) + 2, 85),
          quality: Math.min(prev.quality + Math.floor(Math.random() * 8) + 2, 88),
          identity: Math.min(prev.identity + Math.floor(Math.random() * 8) + 2, 90),
          address: Math.min(prev.address + Math.floor(Math.random() * 8) + 2, 78),
          duplicate: Math.min(prev.duplicate + Math.floor(Math.random() * 8) + 2, 95),
          fraud: Math.min(prev.fraud + Math.floor(Math.random() * 8) + 2, 92)
        };
      });
    }, 150);

    const stepTimeline = async () => {
      let index = 0;
      while (index < stages.length) {
        if (!isActive) return;

        if (stages[index].id === "upload_selfie" && desiredRole !== "barangay_admin") {
          setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "skipped" } : s));
          index++;
          continue;
        }

        setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "running" } : s));

        if (stages[index].id === "ai_read") {
          logger.info("[Timeline] Pausing visual timeline to await Gemini OCR and DB write...", "Timeline");
          while (!promiseResolved) {
            await new Promise((r) => setTimeout(r, 200));
          }
          if (resolvedError) {
            setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "failed" } : s));
            setPipelineError(resolvedError.message || "Onboarding pipeline execution aborted.");
            return;
          }
        }

        await new Promise((r) => setTimeout(r, 650 + Math.random() * 400));

        setStages((prev) => prev.map((s, i) => i === index ? { ...s, status: "completed" } : s));
        index++;
      }

      if (resolvedProfile) {
        const finalScores = resolvedProfile.scores || {};
        setProgressScores({
          idCard: finalScores.idNumberMatch || 100,
          quality: finalScores.imageQualityScore || 90,
          identity: finalScores.nameMatch || 95,
          address: finalScores.barangayMatch || 85,
          duplicate: resolvedProfile.duplicateRisk ? 10 : 100,
          fraud: finalScores.documentAuthenticity || 95
        });
        setSignupResult(resolvedProfile);
      }
    };

    stepTimeline();

    return () => {
      isActive = false;
      clearInterval(progressTimer);
    };
  }, [runSignUp, desiredRole, signupResult, stages.length]);

  const handleResubmit = async () => {
    setResubmitting(true);
    try {
      onCancel();
    } catch (err: any) {
      alert("Failed to reset credentials: " + err.message);
    } finally {
      setResubmitting(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "#10b981";
    if (score >= 75) return "#f59e0b";
    return "#ef4444";
  };

  const overallScore = signupResult?.scores?.overallScore || (signupResult?.duplicateRisk ? 45 : 85);

  return (
    <div style={{ padding: "1rem", width: "100%", textAlign: "left" }}>
      {!signupResult && !pipelineError ? (
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", marginBottom: "0.5rem", textAlign: "center" }}>
            Identity Audit Pipeline
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", marginBottom: "1.5rem" }}>
            Analyzing registration dossier, verifying document OCR, and computing duplicate risks.
          </p>

          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "16px", padding: "1.25rem", marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--role-accent)", display: "block", marginBottom: "0.85rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              🧠 AI Identity Audit Metrics
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                { label: "Government ID", value: progressScores.idCard },
                { label: "Document Quality", value: progressScores.quality },
                { label: "Identity Match", value: progressScores.identity },
                { label: "Address Match", value: progressScores.address },
                { label: "Duplicate Detection", value: progressScores.duplicate },
                { label: "Fraud Detection", value: progressScores.fraud }
              ].map((bar) => (
                <div key={bar.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.2rem", color: "var(--text-secondary)" }}>
                    <span>{bar.label}</span>
                    <strong style={{ color: "var(--text-primary)" }}>{bar.value}%</strong>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "var(--bg-base)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${bar.value}%`, height: "100%", background: "var(--role-accent)", borderRadius: "3px", transition: "width 0.2s ease" }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto", paddingRight: "0.5rem" }}>
            {stages.map((stage) => {
              const isRunning = stage.status === "running";
              const isDone = stage.status === "completed";
              const isSkipped = stage.status === "skipped";

              let dotColor = "var(--bg-elevated)";
              let labelColor = "var(--text-muted)";
              let dotIcon = "•";

              if (isRunning) {
                dotColor = "var(--accent-blue)";
                labelColor = "var(--text-primary)";
                dotIcon = "⏳";
              } else if (isDone) {
                dotColor = "var(--accent-green)";
                labelColor = "var(--text-secondary)";
                dotIcon = "✓";
              } else if (isSkipped) {
                dotColor = "var(--bg-surface)";
                labelColor = "var(--text-muted)";
                dotIcon = "–";
              }

              return (
                <div
                  key={stage.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    fontSize: "0.8rem",
                    opacity: isSkipped ? 0.4 : 1
                  }}
                >
                  <span style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: dotColor,
                    color: "var(--text-inverse)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    fontWeight: 900
                  }}>
                    {dotIcon}
                  </span>
                  <span style={{ color: labelColor, fontWeight: isRunning ? 700 : 500 }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : pipelineError ? (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "var(--accent-danger-soft)", color: "var(--accent-danger)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem auto" }}>
            <AlertTriangle size={30} />
          </div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            Pipeline Interrupted
          </h2>
          <p style={{ color: "var(--accent-danger)", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
            {pipelineError}
          </p>
          <button className="btn btn-primary w-100" onClick={onCancel}>
            Return to Form
          </button>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem", textAlign: "center" }}>
            Verification Result
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", marginBottom: "1.25rem" }}>
            Automated visual assessment complete.
          </p>

          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", borderRadius: "16px", padding: "1.35rem", marginBottom: "1.25rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", display: "block", marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              AI Confidence Score
            </span>
            <span style={{ fontSize: "2.8rem", fontWeight: 900, color: getConfidenceColor(overallScore), letterSpacing: "-1px" }}>
              {overallScore}%
            </span>

            <div style={{ marginTop: "0.85rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>AI Decision:</span>
                <span style={{ fontWeight: 700, color: getConfidenceColor(overallScore) }}>
                  {overallScore >= 90 ? "Low Risk (Auto-Verification Passed)" : overallScore >= 50 ? "Manual Review Required" : "Identity Rejected"}
                </span>
              </div>

              {overallScore >= 90 && (
                <div className="badge badge-success" style={{ margin: "0.4rem auto 0 auto", fontWeight: 700, display: "inline-block" }}>
                  ✓ Verified by AI / Low Risk
                </div>
              )}

              {signupResult.verificationNotes && (
                <div style={{ background: overallScore < 50 ? "var(--accent-danger-soft)" : "rgba(245,158,11,0.08)", border: `1px solid ${overallScore < 50 ? "var(--accent-danger)" : "rgba(245,158,11,0.3)"}`, borderRadius: "12px", padding: "0.75rem", color: overallScore < 50 ? "var(--accent-danger)" : "var(--accent-yellow)", fontSize: "0.8rem", textAlign: "left", marginTop: "0.6rem" }}>
                  <strong>{overallScore < 50 ? "Auto-Rejection Notice:" : "Audit Remark:"}</strong>
                  <p style={{ margin: "0.15rem 0 0 0", lineHeight: 1.35 }}>
                    {overallScore < 50
                      ? "Your uploaded identification does not sufficiently match the information provided. Please submit a clearer government-issued ID."
                      : signupResult.verificationNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Typo Correction Suggestion */}
          {(() => {
            const suggestions: { field: string; current: string; suggested: string }[] = [];
            const extFields = signupResult.aiExtractedFields;
            if (extFields) {
              if (
                profile?.address &&
                extFields.address &&
                profile.address.trim().toLowerCase() !== extFields.address.trim().toLowerCase()
              ) {
                const fuzzy = getFuzzySimilarity(profile.address, extFields.address);
                if (fuzzy >= 50 && fuzzy < 100) {
                  suggestions.push({
                    field: "address",
                    current: profile.address,
                    suggested: extFields.address
                  });
                }
              }
              if (
                profile?.name &&
                extFields.name &&
                profile.name.trim().toLowerCase() !== extFields.name.trim().toLowerCase()
              ) {
                const fuzzy = getFuzzySimilarity(profile.name, extFields.name);
                if (fuzzy >= 60 && fuzzy < 100) {
                  suggestions.push({
                    field: "name",
                    current: profile.name,
                    suggested: extFields.name
                  });
                }
              }
              if (
                profile?.idNumber &&
                extFields.idNumber &&
                profile.idNumber.trim().toLowerCase() !== extFields.idNumber.trim().toLowerCase()
              ) {
                const fuzzy = getFuzzySimilarity(profile.idNumber, extFields.idNumber);
                if (fuzzy >= 70 && fuzzy < 100) {
                  suggestions.push({
                    field: "idNumber",
                    current: profile.idNumber,
                    suggested: extFields.idNumber
                  });
                }
              }
            }

            if (suggestions.length === 0) return null;

            return (
              <div style={{ marginTop: "1rem", background: "var(--role-accent-soft)", border: "1px solid var(--role-accent-border)", borderRadius: "12px", padding: "1rem", textAlign: "left", marginBottom: "1.25rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--role-accent)", marginBottom: "0.5rem" }}>
                  📋 AI Typo Correction Suggested
                </div>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: "0.75rem" }}>
                  We noticed some minor spelling or formatting differences between your inputs and the text extracted from your ID card. Select the fields you would like to correct:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "0.85rem" }}>
                  {suggestions.map((sug) => {
                    const isSelected = selectedCorrections.includes(sug.field);
                    return (
                      <div
                        key={sug.field}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          background: "var(--bg-surface)",
                          border: isSelected ? "1px solid var(--role-accent)" : "1px solid var(--border-primary)",
                          borderRadius: "8px",
                          padding: "0.6rem",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                        onClick={() => {
                          setSelectedCorrections((prev) =>
                            prev.includes(sug.field)
                              ? prev.filter((f) => f !== sug.field)
                              : [...prev, sug.field]
                          );
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{ marginTop: "0.15rem", cursor: "pointer" }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, textTransform: "capitalize", color: "var(--text-primary)" }}>
                            {sug.field === "idNumber" ? "ID Number" : sug.field}
                          </div>
                          <div style={{ color: "var(--text-muted)", textDecoration: "line-through", fontSize: "0.7rem", marginTop: "0.1rem" }}>
                            Current: {sug.current}
                          </div>
                          <div style={{ color: "var(--accent-green)", fontWeight: 600, fontSize: "0.72rem", marginTop: "0.1rem" }}>
                            Suggested: {sug.suggested}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "0.72rem", padding: "0.45rem 0.9rem", width: "auto" }}
                  disabled={selectedCorrections.length === 0 || applyingCorrections}
                  onClick={async () => {
                    setApplyingCorrections(true);
                    try {
                      const updates: any = {};
                      suggestions.forEach((sug) => {
                        if (selectedCorrections.includes(sug.field)) {
                          updates[sug.field] = sug.suggested;
                          if (sug.field === "name") {
                            updates.displayName = sug.suggested;
                          }
                        }
                      });
                      if (profile) {
                        await userRepository.updateUserProfile(profile.uid, updates);
                      }
                      setSelectedCorrections([]);
                      alert("Details updated successfully to match your ID card!");
                    } catch (err: any) {
                      alert("Failed to update details: " + err.message);
                    } finally {
                      setApplyingCorrections(false);
                    }
                  }}
                >
                  {applyingCorrections ? "Applying..." : "Correct Selected Details"}
                </button>
              </div>
            );
          })()}

          {overallScore >= 50 ? (
            <button className="btn btn-primary w-100" onClick={() => onComplete(signupResult)} style={{ height: "46px" }}>
              Proceed to Dashboard
            </button>
          ) : (
            <button className="btn btn-outline-danger w-100" onClick={handleResubmit} disabled={resubmitting} style={{ height: "46px" }}>
              {resubmitting ? "Preparing Recovery..." : "Review & Resubmit"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VerificationLoadingTimeline;
