import { DEBUG_MODE } from "../config/debug";

export type LogCategory =
  | "DEBUG"
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "CRITICAL"
  | "AUDIT"
  | "NETWORK"
  | "AI"
  | "BLOCKCHAIN"
  | "AUTH"
  | "DATABASE"
  | "UI";

export interface LogEntry {
  id: string;
  timestamp: string;
  category: LogCategory;
  message: string;
  module: string;
  functionName?: string;
  durationMs?: number;
  correlationId?: string;
  transactionId?: string;
  metadata?: any;
  userContext?: {
    email: string;
    role: string;
    barangay: string;
    uid: string;
  };
}

type LogListener = (entry: LogEntry) => void;

class UniversalLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 1000;
  private userContext: { email: string; role: string; barangay: string; uid: string } | null = null;

  setUserContext(user: { email: string; role: string; barangayName?: string; uid: string } | null) {
    if (!user) {
      this.userContext = null;
    } else {
      this.userContext = {
        email: user.email,
        role: user.role,
        barangay: user.barangayName || "Unassigned",
        uid: user.uid
      };
    }
  }

  log(
    category: LogCategory,
    message: string,
    module: string,
    options?: {
      functionName?: string;
      durationMs?: number;
      correlationId?: string;
      transactionId?: string;
      metadata?: any;
    }
  ) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      category,
      message,
      module,
      functionName: options?.functionName,
      durationMs: options?.durationMs,
      correlationId: options?.correlationId,
      transactionId: options?.transactionId,
      metadata: options?.metadata,
      userContext: this.userContext || undefined
    };

    // Store in circular array
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Call subscribers
    this.listeners.forEach((listener) => listener(entry));

    // Console output in DEBUG_MODE or for status/AI results (success, warning, error, critical, AI)
    if (DEBUG_MODE || category === "SUCCESS" || category === "WARNING" || category === "ERROR" || category === "CRITICAL" || category === "AI") {
      const timeStr = new Date(entry.timestamp).toLocaleTimeString();
      const userStr = this.userContext ? `[${this.userContext.email} - ${this.userContext.role}]` : "[GUEST]";
      const prefix = `[${entry.category}] [${entry.module}]${options?.functionName ? ` [${options.functionName}]` : ""} ${timeStr} ${userStr}`;
      
      const metaOutput = entry.metadata ? entry.metadata : "";
      const durStr = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : "";

      switch (category) {
        case "ERROR":
        case "CRITICAL":
          console.error(prefix, message, durStr, metaOutput);
          break;
        case "WARNING":
          console.warn(prefix, message, durStr, metaOutput);
          break;
        case "SUCCESS":
          console.log(`%c${prefix} ${message}${durStr}`, "color: #10b981; font-weight: bold;", metaOutput);
          break;
        case "AI":
          console.log(`%c${prefix} ${message}${durStr}`, "color: #8b5cf6; font-weight: bold;", metaOutput);
          break;
        case "BLOCKCHAIN":
          console.log(`%c${prefix} ${message}${durStr}`, "color: #0284c7; font-weight: bold;", metaOutput);
          break;
        case "NETWORK":
          console.log(`%c${prefix} ${message}${durStr}`, "color: #f59e0b; font-weight: bold;", metaOutput);
          break;
        default:
          console.log(prefix, message, durStr, metaOutput);
      }
    }
  }

  // Helper shortcuts
  debug(message: string, module: string, options?: any) { this.log("DEBUG", message, module, options); }
  info(message: string, module: string, options?: any) { this.log("INFO", message, module, options); }
  success(message: string, module: string, options?: any) { this.log("SUCCESS", message, module, options); }
  warn(message: string, module: string, options?: any) { this.log("WARNING", message, module, options); }
  error(message: string, module: string, options?: any) { this.log("ERROR", message, module, options); }
  critical(message: string, module: string, options?: any) { this.log("CRITICAL", message, module, options); }
  audit(message: string, module: string, options?: any) { this.log("AUDIT", message, module, options); }
  network(message: string, module: string, options?: any) { this.log("NETWORK", message, module, options); }
  ai(message: string, module: string, options?: any) { this.log("AI", message, module, options); }
  blockchain(message: string, module: string, options?: any) { this.log("BLOCKCHAIN", message, module, options); }
  auth(message: string, module: string, options?: any) { this.log("AUTH", message, module, options); }
  database(message: string, module: string, options?: any) { this.log("DATABASE", message, module, options); }
  ui(message: string, module: string, options?: any) { this.log("UI", message, module, options); }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    // Trigger update on clears
    this.listeners.forEach((listener) => listener({
      id: "CLEAR",
      timestamp: new Date().toISOString(),
      category: "INFO",
      message: "Observability cache cleared by user.",
      module: "SYSTEM"
    }));
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const logger = new UniversalLogger();
