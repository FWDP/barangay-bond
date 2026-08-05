import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { logger } from "../utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log critical crash to universal logger
    logger.log("CRITICAL", `React Component Crash: ${error.message}`, "UI", {
      functionName: "ErrorBoundary.componentDidCatch",
      metadata: {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        href: window.location.href
      }
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
          padding: "2rem",
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "center"
        }}>
          <div style={{
            background: "#1e293b",
            border: "1px solid #ef4444",
            borderRadius: "16px",
            padding: "2.5rem",
            maxWidth: "600px",
            width: "100%",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
          }}>
            <h2 style={{ color: "#ef4444", fontWeight: 800, fontSize: "1.8rem", margin: "0 0 1rem 0" }}>System Crash Shield</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Barangay Bond sandbox safety caught a critical UI rendering error. The execution state details have been logged to the Developer Console.
            </p>
            
            <div style={{
              background: "#0f172a",
              borderRadius: "8px",
              padding: "1rem",
              textAlign: "left",
              maxHeight: "200px",
              overflowY: "auto",
              fontSize: "0.8rem",
              fontFamily: "monospace",
              color: "#f1f5f9",
              border: "1px solid #334155",
              marginBottom: "1.5rem"
            }}>
              <strong>Error:</strong> {this.state.error?.toString()}<br/>
              <strong>Stack:</strong> {this.state.error?.stack}
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Reload Application
              </button>
              <button 
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                style={{
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #475569",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "8px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Try Re-render
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
