// Central switches for debug & telemetry logs
const storedDebug = localStorage.getItem("BB_DEBUG_MODE");

export const DEBUG_MODE = storedDebug === null 
  ? (import.meta.env.DEV || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  : storedDebug === "true";

export function setDebugMode(enabled: boolean) {
  localStorage.setItem("BB_DEBUG_MODE", enabled ? "true" : "false");
  window.location.reload();
}
