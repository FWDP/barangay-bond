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
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          padding: "2rem",
          fontFamily: "var(--font-main)",
          textAlign: "center"
        }}>
          <div className="bank-card" style={{
            border: "1px solid var(--accent-danger)",
            padding: "2.5rem",
            maxWidth: "600px",
            width: "100%",
            boxShadow: "var(--shadow-floating)"
          }}>
            <h2 style={{ color: "var(--accent-danger)", fontWeight: 800, fontSize: "1.8rem", margin: "0 0 1rem 0" }}>System Crash Shield</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Barangay Bond sandbox safety caught a critical UI rendering error. The execution state details have been logged to the Developer Console.
            </p>
            
            <div style={{
              background: "var(--bg-elevated)",
              borderRadius: "12px",
              padding: "1rem",
              textAlign: "left",
              maxHeight: "200px",
              overflowY: "auto",
              fontSize: "0.8rem",
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-primary)",
              marginBottom: "1.5rem"
            }}>
              <strong>Error:</strong> {this.state.error?.toString()}<br/>
              <strong>Stack:</strong> {this.state.error?.stack}
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button 
                className="btn btn-danger"
                onClick={() => window.location.reload()}
              >
                Reload Application
              </button>
              <button 
                className="btn btn-outline"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
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
