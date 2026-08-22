import React, { useState, useEffect, useRef } from "react";
import { DEBUG_MODE, setDebugMode } from "../config/debug";
import { logger } from "../utils/logger";
import type { LogEntry, LogCategory } from "../utils/logger";
import { X, Search, Download, Clipboard, Trash2, Terminal, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "../services/firebase";
import { collection, query, orderBy, onSnapshot, getDocs, writeBatch } from "firebase/firestore";
import { useLoading } from "../contexts/LoadingContext";

export const DevConsole: React.FC = () => {
  if (!DEBUG_MODE) return null;

  const { startLoading, stopLoading } = useLoading();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "auth" | "firestore" | "gemini" | "wallet" | "soroban" | "events" | "errors" | "emails"
  >("general");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | "ALL">("ALL");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to Firestore mail collection for telemetry
  useEffect(() => {
    if (!DEBUG_MODE) return;
    const q = query(collection(db, "mail"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setEmails(list);
      },
      (err) => {
        // Silently log permission or offline error in debug mode without raising unhandled exception
        logger.debug(`[DevConsole] Mail stream notice: ${err.message}`, "Firestore");
      }
    );
    return () => unsubscribe();
  }, []);

  // Subscribe to logger telemetry
  useEffect(() => {
    setLogs(logger.getLogs());

    const unsubscribe = logger.subscribe((newEntry) => {
      if (newEntry.id === "CLEAR") {
        setLogs([]);
      } else {
        setLogs((prev) => {
          const next = [...prev, newEntry];
          if (next.length > 1000) next.shift();
          return next;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to keyboard shortcut Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-scroll logs when drawer is open
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen, activeTab]);

  const handleResetProposals = async () => {
    if (!window.confirm("Are you sure you want to reset all approved proposals back to Pending Review so you can re-approve them on the new contract?")) return;
    try {
      startLoading({
        category: "crud",
        title: "💾 Resetting Proposals Status",
        message: "Applying rollback states to all Firestore proposal documents...",
      });
      const q = query(collection(db, "project_proposals"));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      snapshot.forEach((d) => {
        batch.update(d.ref, {
          status: "pending_admin_approval",
          onChainProjectId: null,
          txHash: null,
          phaseProofRequirements: null,
          additionalProofs: null,
        });
        count++;
      });
      await batch.commit();
      alert(`Successfully reset ${count} proposals back to pending admin approval!`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to reset proposals: " + err.message);
    } finally {
      stopLoading();
    }
  };

  const handleDeleteAllProposals = async () => {
    if (!window.confirm("Are you sure you want to PERMANENTLY delete all project proposals in Firestore?")) return;
    try {
      startLoading({
        category: "crud",
        title: "💾 Deleting Project Proposals",
        message: "Wiping all proposal entries and audit summaries from Firestore...",
      });
      const q = query(collection(db, "project_proposals"));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      snapshot.forEach((d) => {
        batch.delete(d.ref);
        count++;
      });
      await batch.commit();
      alert(`Successfully deleted ${count} proposals!`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete proposals: " + err.message);
    } finally {
      stopLoading();
    }
  };

  const handleExport = (format: "json" | "csv" | "txt") => {
    const filtered = getFilteredLogs();
    let content = "";
    let mimeType = "text/plain";
    let extension = "txt";

    if (format === "json") {
      content = JSON.stringify(filtered, null, 2);
      mimeType = "application/json";
      extension = "json";
    } else if (format === "csv") {
      const headers = "Timestamp,Category,Module,Message,Duration(ms),CorrelationID\n";
      const rows = filtered.map(l =>
        `"${l.timestamp}","${l.category}","${l.module}","${l.message.replace(/"/g, '""')}","${l.durationMs ?? ''}","${l.correlationId ?? ''}"`
      ).join("\n");
      content = headers + rows;
      mimeType = "text/csv";
      extension = "csv";
    } else {
      content = filtered.map(l =>
        `[${l.timestamp}] [${l.category}] [${l.module}] ${l.message} ${l.durationMs ? `(${l.durationMs}ms)` : ""}`
      ).join("\n");
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bb_observability_logs_${Date.now()}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    logger.success(`Exported ${filtered.length} logs as ${format.toUpperCase()}`, "DEVELOPER_CONSOLE");
  };

  const handleCopy = () => {
    const text = getFilteredLogs().map(l =>
      `[${l.timestamp}] [${l.category}] [${l.module}] ${l.message}`
    ).join("\n");
    navigator.clipboard.writeText(text);
    alert("Copied logs to clipboard.");
    logger.success("Logs copied to clipboard", "DEVELOPER_CONSOLE");
  };

  const getFilteredLogs = () => {
    return logs.filter((log) => {
      // 1. Text filter
      const textMatch =
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.module.toLowerCase().includes(searchQuery.toLowerCase());

      if (!textMatch) return false;

      // 2. Category Dropdown filter
      if (categoryFilter !== "ALL" && log.category !== categoryFilter) return false;

      // 3. Tab-based filters
      switch (activeTab) {
        case "auth":
          return log.category === "AUTH" || log.module === "AUTH";
        case "firestore":
          return log.category === "DATABASE" || log.module === "FIRESTORE" || log.module === "DATABASE";
        case "gemini":
          return log.category === "AI" || log.module === "GEMINI" || log.module === "DUPLICATE_CHECK";
        case "wallet":
          return log.module === "WALLET" || log.message.toLowerCase().includes("wallet");
        case "soroban":
          return log.category === "BLOCKCHAIN" || log.module === "TRANSACTIONS" || log.module === "SOROBAN";
        case "errors":
          return log.category === "ERROR" || log.category === "CRITICAL" || log.category === "WARNING";
        case "events":
          return log.category === "AUDIT" || log.category === "SUCCESS" || log.category === "INFO";
        case "general":
        default:
          return true;
      }
    });
  };

  const filteredLogs = getFilteredLogs();

  return (
    <>
      {/* Floating Toggle Inspect Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "1rem",
          right: "1rem",
          background: "#0f172a",
          border: "1px solid #334155",
          color: "#38bdf8",
          borderRadius: "50%",
          width: "48px",
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          cursor: "pointer",
          zIndex: 9999,
          transition: "transform 0.2s ease"
        }}
        title="Open Developer Console (Ctrl+Shift+D)"
        className="hover-scale"
      >
        <Terminal size={22} />
      </button>

      {/* Observability Sliding Drawer Console */}
      {isOpen && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "420px",
          background: "#090d16",
          borderTop: "2px solid #1e293b",
          color: "#cbd5e1",
          fontFamily: "monospace",
          fontSize: "0.78rem",
          zIndex: 9998,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.4)"
        }}>
          {/* Console Header Control bar */}
          <div style={{
            background: "#0f172a",
            borderBottom: "1px solid #1e293b",
            padding: "0.5rem 1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Terminal size={16} style={{ color: "#38bdf8" }} />
              <strong style={{ color: "#f8fafc", fontSize: "0.85rem" }}>Barangay Bond Observability Suite</strong>
              <span style={{ background: "#1e293b", padding: "0.15rem 0.4rem", borderRadius: "4px", fontSize: "0.65rem", color: "#94a3b8" }}>
                DEBUG MODE: ON
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
              {/* Search Bar */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={14} style={{ position: "absolute", left: "6px", color: "#64748b" }} />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "#090d16",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    padding: "0.25rem 0.5rem 0.25rem 1.6rem",
                    color: "#f8fafc",
                    fontSize: "0.75rem",
                    width: "160px"
                  }}
                />
              </div>

              {/* Log Level select */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                style={{
                  background: "#090d16",
                  border: "1px solid #334155",
                  color: "#f8fafc",
                  borderRadius: "6px",
                  padding: "0.25rem",
                  fontSize: "0.75rem"
                }}
              >
                <option value="ALL">ALL LEVELS</option>
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="DATABASE">DATABASE</option>
                <option value="NETWORK">NETWORK</option>
                <option value="AI">AI</option>
                <option value="BLOCKCHAIN">BLOCKCHAIN</option>
                <option value="AUTH">AUTH</option>
              </select>

              {/* Action Buttons */}
              <button onClick={handleCopy} title="Copy Logs" style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <Clipboard size={16} />
              </button>
              <button onClick={() => handleExport("json")} title="Export JSON" style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <Download size={16} />
              </button>
              <button onClick={() => logger.clearLogs()} title="Clear Log Buffer" style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Console Tab Selectors */}
          <div style={{
            background: "#0b1329",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            gap: "0.2rem",
            padding: "0.2rem 0.5rem"
          }}>
            {((["general", "auth", "firestore", "gemini", "wallet", "soroban", "events", "errors", ...((import.meta.env.DEV || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") ? ["emails"] : [])]) as ("general" | "auth" | "firestore" | "gemini" | "wallet" | "soroban" | "events" | "errors" | "emails")[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? "#0f172a" : "transparent",
                  color: activeTab === tab ? "#38bdf8" : "#94a3b8",
                  border: "none",
                  padding: "0.3rem 0.75rem",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  fontWeight: activeTab === tab ? 700 : 500
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Console Inner Log List Viewport */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.8rem",
            background: "#040711",
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem"
          }}>
            {activeTab === "general" && (
              <div style={{
                background: "#0b1329",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem"
              }}>
                <strong style={{ color: "#38bdf8", fontSize: "0.82rem" }}>Observability Sandbox Control</strong>
                <div style={{ fontSize: "0.75rem" }}>
                  Active Hostname: <span style={{ color: "#f59e0b" }}>{window.location.hostname}</span> |
                  Captured Telemetry Log Records: <strong style={{ color: "#10b981" }}>{logs.length}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => setDebugMode(false)}
                    style={{
                      background: "#ef4444",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.35rem 0.8rem",
                      borderRadius: "6px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.72rem"
                    }}
                  >
                    DISABLE DEBUG MODE (Production View)
                  </button>
                  <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                    Warning: Turning this off disables this console overlay.
                  </span>
                </div>

                <strong style={{ color: "#38bdf8", fontSize: "0.82rem", marginTop: "0.8rem", display: "block" }}>Database Reset & Maintenance</strong>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                  <button
                    onClick={handleResetProposals}
                    style={{
                      background: "#f59e0b",
                      color: "#0f172a",
                      border: "none",
                      padding: "0.35rem 0.8rem",
                      borderRadius: "6px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.72rem"
                    }}
                  >
                    🔄 RESET APPROVED PROPOSALS TO PENDING REVIEW
                  </button>
                  <button
                    onClick={handleDeleteAllProposals}
                    style={{
                      background: "#ef4444",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.35rem 0.8rem",
                      borderRadius: "6px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.72rem"
                    }}
                  >
                    🗑️ DELETE ALL PROPOSALS
                  </button>
                </div>
              </div>
            )}

            {activeTab === "emails" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ background: "#0b1329", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.85rem", marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#38bdf8", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Mail size={14} /> Outbound Telemetry Mail Auditing
                  </strong>
                  <p style={{ margin: "0.2rem 0 0 0", color: "#94a3b8", fontSize: "0.7rem" }}>
                    Listening to Firestore `/mail` writes dispatched to SMTP via the firestore-send-email extension.
                  </p>
                </div>

                {emails.length === 0 ? (
                  <div style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", padding: "2rem" }}>
                    No outbound mail documents found in `/mail` collection.
                  </div>
                ) : (
                  emails.map((m) => {
                    const isExpanded = expandedEmailId === m.id;
                    const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleString() : "Unknown Time";
                    const deliveryState = m.delivery?.state || "Queued";
                    const isSuccess = deliveryState === "SUCCESS";
                    const isError = deliveryState === "ERROR";

                    return (
                      <div
                        key={m.id}
                        style={{
                          background: "#0e1626",
                          border: "1px solid #1e293b",
                          borderRadius: "8px",
                          overflow: "hidden"
                        }}
                      >
                        {/* Header bar */}
                        <div
                          onClick={() => setExpandedEmailId(isExpanded ? null : m.id)}
                          style={{
                            padding: "0.6rem 0.85rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            background: isExpanded ? "#141f36" : "transparent"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "4px",
                              background: isSuccess ? "rgba(16, 185, 129, 0.15)" : isError ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                              color: isSuccess ? "#34d399" : isError ? "#f87171" : "#fbbf24",
                              flexShrink: 0
                            }}>
                              {deliveryState.toUpperCase()}
                            </span>
                            <span style={{ color: "#f8fafc", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.message?.subject || "(No Subject)"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", color: "#64748b", fontSize: "0.7rem", flexShrink: 0 }}>
                            <span>To: {m.to?.join(", ") || "N/A"}</span>
                            <span>{dateStr}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>

                        {/* Content details panel */}
                        {isExpanded && (
                          <div style={{ padding: "0.85rem", borderTop: "1px solid #1e293b", background: "#090d16" }}>
                            {m.delivery?.error && (
                              <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "6px", padding: "0.6rem", color: "#f87171", fontSize: "0.72rem", marginBottom: "0.6rem" }}>
                                <strong>Delivery Error:</strong> {m.delivery.error}
                              </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem", fontSize: "0.72rem", color: "#94a3b8" }}>
                              <div><strong>Document ID:</strong> {m.id}</div>
                              {m.delivery?.attempts !== undefined && (
                                <div><strong>Attempts:</strong> {m.delivery.attempts}</div>
                              )}
                              {m.delivery?.endTime && (
                                <div><strong>End Time:</strong> {new Date(m.delivery.endTime.toDate ? m.delivery.endTime.toDate() : m.delivery.endTime).toLocaleString()}</div>
                              )}
                            </div>

                            <strong style={{ color: "#38bdf8", fontSize: "0.72rem", display: "block", marginBottom: "0.4rem" }}>
                              EMAIL HTML CONTENT PREVIEW
                            </strong>
                            <div style={{ border: "1px solid #1e293b", borderRadius: "6px", background: "#ffffff", padding: "0.5rem", overflow: "hidden" }}>
                              <iframe
                                title={`preview-${m.id}`}
                                srcDoc={m.message?.html || ""}
                                style={{
                                  width: "100%",
                                  height: "220px",
                                  border: "none",
                                  background: "#ffffff"
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", padding: "2rem" }}>
                No structured telemetry records found matching the active filters.
              </div>
            ) : (
              filteredLogs.map((log) => {
                // Color mapping for category highlights
                let color = "#cbd5e1";
                if (log.category === "ERROR" || log.category === "CRITICAL") color = "#f87171";
                else if (log.category === "WARNING") color = "#fbbf24";
                else if (log.category === "SUCCESS") color = "#34d399";
                else if (log.category === "AI") color = "#c084fc";
                else if (log.category === "BLOCKCHAIN") color = "#38bdf8";
                else if (log.category === "NETWORK") color = "#f59e0b";
                else if (log.category === "AUTH") color = "#f472b6";

                return (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "0.35rem 0.5rem",
                      borderLeft: `3px solid ${color}`,
                      background: "rgba(30, 41, 59, 0.15)",
                      borderRadius: "0 4px 4px 0",
                      lineHeight: "1.4"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ color, fontWeight: 700, marginRight: "0.4rem" }}>[{log.category}]</span>
                        <span style={{ color: "#94a3b8", marginRight: "0.4rem" }}>[{log.module}]</span>
                        {log.functionName && (
                          <span style={{ color: "#64748b", fontStyle: "italic", marginRight: "0.4rem" }}>
                            [{log.functionName}]
                          </span>
                        )}
                        <span style={{ color: "#f8fafc" }}>{log.message}</span>
                      </div>
                      <span style={{ color: "#475569", fontSize: "0.68rem" }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Render execution timings, correlation IDs, or custom metadata */}
                    {(log.durationMs !== undefined || log.correlationId || log.userContext || log.metadata) && (
                      <div style={{
                        marginTop: "0.2rem",
                        paddingLeft: "1rem",
                        color: "#64748b",
                        fontSize: "0.72rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.15rem"
                      }}>
                        <div style={{ display: "flex", gap: "1rem" }}>
                          {log.durationMs !== undefined && (
                            <span>Latency: <strong style={{ color: "#fbbf24" }}>{log.durationMs}ms</strong></span>
                          )}
                          {log.correlationId && (
                            <span>CorrID: <strong style={{ color: "#c084fc" }}>{log.correlationId}</strong></span>
                          )}
                          {log.transactionId && (
                            <span>TxHash: <strong style={{ color: "#38bdf8" }}>{log.transactionId}</strong></span>
                          )}
                          {log.userContext && (
                            <span>User: <strong style={{ color: "#f472b6" }}>{log.userContext.email} ({log.userContext.role})</strong></span>
                          )}
                        </div>
                        {log.metadata && (
                          <pre style={{
                            margin: "0.2rem 0 0 0",
                            background: "#090d16",
                            padding: "0.4rem",
                            borderRadius: "4px",
                            border: "1px solid #1e293b",
                            color: "#94a3b8",
                            overflowX: "auto",
                            fontSize: "0.68rem",
                            fontFamily: "monospace"
                          }}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  );
};
