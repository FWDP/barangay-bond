import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  QrCode,
  Camera,
  Copy,
  Check,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  FileText
} from "lucide-react";
import { generateQrUrl, formatStellarPaymentUri, parseScannedStellarQr } from "../utils/qrcode";
import { formatXlmToPhp } from "../utils/currency";
import { sendNativePayment } from "../transactions/transactions";
import { generatePaymentReceiptPdf, type ReceiptData } from "../utils/receipt";
import type { TransactionStatus } from "../types";

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  xlmBalance: string;
  initialTab?: "receive" | "pay";
  secretKey?: string;
  onExecute?: (
    actionFn: (
      onStatusChange: (status: TransactionStatus, txHash?: string, error?: string) => void
    ) => Promise<string>
  ) => void;
}

export const QrModal: React.FC<QrModalProps> = ({
  isOpen,
  onClose,
  userAddress,
  xlmBalance,
  initialTab = "receive",
  secretKey,
  onExecute,
}) => {
  const [activeTab, setActiveTab] = useState<"receive" | "pay">(initialTab);
  
  // Receive State
  const [receiveAmount, setReceiveAmount] = useState("");
  const [receiveMemo, setReceiveMemo] = useState("");
  const [copied, setCopied] = useState(false);

  // Pay State
  const [recipientAddress, setRecipientAddress] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMemo, setPayMemo] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessTx, setSendSuccessTx] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastSentReceiptData, setLastSentReceiptData] = useState<ReceiptData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSendSuccessTx(null);
      setSendError(null);
    } else {
      stopCamera();
    }
  }, [isOpen, initialTab]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const receiveQrData = formatStellarPaymentUri(
    userAddress || "GDTT...DEMO_ADDRESS",
    receiveAmount,
    receiveMemo
  );
  const receiveQrImageSrc = generateQrUrl(receiveQrData, 300);

  const handleDownloadQr = () => {
    const link = document.createElement("a");
    link.href = receiveQrImageSrc;
    link.download = `Stellar-Receive-${(userAddress || "wallet").slice(0, 8)}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Camera QR Scanner Loop
  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera is not supported on this browser or connection is not HTTPS.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if BarcodeDetector is available natively
      if ("BarcodeDetector" in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const scannedRaw = barcodes[0].rawValue;
                handleScannedData(scannedRaw);
              }
            } catch (err) {
              // ignore detection tick errors
            }
          }
        }, 300);
      } else {
        // Fallback canvas frame scanner
        scanIntervalRef.current = setInterval(() => {
          if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = videoRef.current.videoWidth || 300;
              canvas.height = videoRef.current.videoHeight || 300;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            }
          }
        }, 500);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(err.message || "Failed to access device camera. Please allow camera permissions.");
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleScannedData = (data: string) => {
    const parsed = parseScannedStellarQr(data);
    if (parsed.address) {
      setRecipientAddress(parsed.address);
      if (parsed.amount) setPayAmount(parsed.amount);
      if (parsed.memo) setPayMemo(parsed.memo);
      stopCamera();
    }
  };

  const handleSendPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setSendSuccessTx(null);

    const amt = parseFloat(payAmount);
    if (!recipientAddress.trim().startsWith("G") || recipientAddress.trim().length !== 56) {
      setSendError("Please enter or scan a valid 56-character Stellar Public Key (starts with 'G').");
      return;
    }

    if (isNaN(amt) || amt <= 0) {
      setSendError("Please enter a valid transfer amount in XLM.");
      return;
    }

    const currentBal = parseFloat(xlmBalance) || 0;
    if (amt > currentBal) {
      setSendError(`Insufficient balance. You currently have ${currentBal} XLM available.`);
      return;
    }

    const receiptPayload: ReceiptData = {
      txHash: "",
      senderAddress: userAddress,
      recipientAddress: recipientAddress.trim(),
      amountXlm: amt.toFixed(7),
      memo: payMemo.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    if (onExecute) {
      onExecute(async (onStatusChange) => {
        const txHash = await sendNativePayment(
          userAddress,
          recipientAddress.trim(),
          amt.toFixed(7),
          payMemo.trim() || undefined,
          onStatusChange,
          secretKey
        );
        setSendSuccessTx(txHash);
        setLastSentReceiptData({ ...receiptPayload, txHash });
        setRecipientAddress("");
        setPayAmount("");
        setPayMemo("");
        return txHash;
      });
    } else {
      setIsSending(true);
      try {
        const txHash = await sendNativePayment(
          userAddress,
          recipientAddress.trim(),
          amt.toFixed(7),
          payMemo.trim() || undefined,
          undefined,
          secretKey
        );
        setSendSuccessTx(txHash);
        setLastSentReceiptData({ ...receiptPayload, txHash });
        setRecipientAddress("");
        setPayAmount("");
        setPayMemo("");
      } catch (err: any) {
        setSendError(err.message || "Payment transaction failed.");
      } finally {
        setIsSending(false);
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          width: "100%",
          maxWidth: "480px",
          padding: "1.75rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-primary)",
          boxShadow: "var(--shadow-floating)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--role-accent-soft)", color: "var(--role-badge-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Stellar QR Pay & Transfer
              </h3>
              <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                Instant peer-to-peer on-chain settlement
              </span>
            </div>
          </div>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onClose}
            style={{ width: "32px", height: "32px" }}
          >
            <X size={18} />
          </button>
        </div>

        {!userAddress ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                background: "var(--role-accent-soft)",
                color: "var(--role-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
              }}
            >
              <CreditCard size={28} />
            </div>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Stellar Wallet Not Linked
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "340px", margin: "0 auto 1.5rem auto", lineHeight: "1.5" }}>
              To pay, transfer, or generate a receive QR code, you must first connect and link your Stellar wallet.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg w-100 tap-scale"
              onClick={onClose}
            >
              Close & Link Wallet
            </button>
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.4rem",
                background: "var(--bg-elevated)",
                padding: "0.3rem",
                borderRadius: "14px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "1.5rem",
              }}
            >
              <button
                type="button"
                className={`btn btn-sm tap-scale ${activeTab === "receive" ? "btn-primary" : "btn-outline"}`}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                  fontWeight: 700,
                }}
                onClick={() => {
                  setActiveTab("receive");
                  stopCamera();
                }}
              >
                <ArrowDownLeft size={15} /> Receive XLM
              </button>
              <button
                type="button"
                className={`btn btn-sm tap-scale ${activeTab === "pay" ? "btn-primary" : "btn-outline"}`}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                  fontWeight: 700,
                }}
                onClick={() => setActiveTab("pay")}
              >
                <ArrowUpRight size={15} /> Pay / Send XLM
              </button>
            </div>

            {/* TAB 1: RECEIVE (QR GENERATOR) */}
            {activeTab === "receive" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }}>
                {/* QR Card Frame */}
                <div
                  style={{
                    background: "#ffffff",
                    padding: "1.25rem",
                    borderRadius: "20px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
                    border: "2px solid var(--border-primary)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <img
                    src={receiveQrImageSrc}
                    alt="Receive Stellar QR Code"
                    style={{ width: "200px", height: "200px", borderRadius: "10px", display: "block" }}
                  />
                  <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Scan to Pay via Stellar
                  </div>
                </div>

                {/* Address Pill */}
                <div style={{ width: "100%" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.3rem", display: "block" }}>
                    Your Stellar Public Key
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-primary)",
                      borderRadius: "12px",
                      padding: "0.6rem 0.85rem",
                      gap: "0.5rem",
                    }}
                  >
                    <code style={{ fontSize: "0.78rem", color: "var(--text-primary)", wordBreak: "break-all", fontFamily: "monospace" }}>
                      {userAddress || "No linked address"}
                    </code>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline tap-scale"
                      onClick={() => handleCopy(userAddress)}
                      style={{ padding: "0.35rem 0.65rem", flexShrink: 0 }}
                      title="Copy address"
                    >
                      {copied ? <Check size={14} style={{ color: "var(--accent-green)" }} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Optional Request Amount & Memo */}
                <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Request Amount (XLM)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Optional XLM"
                      className="form-control"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Approximate Value</label>
                    <div
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "10px",
                        padding: "0.65rem 0.85rem",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      ≈ {formatXlmToPhp(parseFloat(receiveAmount) || 0)}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ width: "100%", margin: 0 }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Transaction Note / Memo (Optional)</label>
                  <input
                    type="text"
                    maxLength={28}
                    placeholder="e.g. Budget Audit, SK Support"
                    className="form-control"
                    value={receiveMemo}
                    onChange={(e) => setReceiveMemo(e.target.value)}
                  />
                </div>

                <div style={{ width: "100%", display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-outline w-100 tap-scale"
                    onClick={handleDownloadQr}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
                  >
                    <Download size={15} /> Save QR Image
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary w-100 tap-scale"
                    onClick={() => handleCopy(receiveQrData)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />} Copy Payment Link
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: PAY / SEND (WITH CAMERA SCANNER) */}
            {activeTab === "pay" && (
              <form onSubmit={handleSendPayment} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                {/* Live Camera Viewfinder or Toggle Button */}
                {cameraActive ? (
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "220px",
                      background: "#000000",
                      borderRadius: "18px",
                      overflow: "hidden",
                      border: "2px solid var(--role-accent-border)",
                      boxShadow: "0 0 20px var(--role-accent-soft)",
                    }}
                  >
                    <video
                      ref={videoRef}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                    
                    {/* Viewfinder Laser Animation */}
                    <div
                      style={{
                        position: "absolute",
                        top: "15%",
                        left: "15%",
                        right: "15%",
                        bottom: "15%",
                        border: "2px dashed #10b981",
                        borderRadius: "14px",
                        pointerEvents: "none",
                      }}
                    />

                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={stopCamera}
                      style={{ position: "absolute", bottom: "10px", right: "10px", zIndex: 10 }}
                    >
                      Stop Camera
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline w-100 tap-scale"
                    onClick={startCamera}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      height: "50px",
                      background: "var(--bg-elevated)",
                      border: "1px dashed var(--role-accent-border)",
                    }}
                  >
                    <Camera size={18} style={{ color: "var(--role-accent)" }} />
                    <span>📷 Scan QR Code with Device Camera</span>
                  </button>
                )}

                {cameraError && (
                  <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "10px", padding: "0.6rem 0.8rem", color: "var(--accent-danger)", fontSize: "0.78rem" }}>
                    {cameraError}
                  </div>
                )}

                {/* Recipient Input */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Recipient Stellar Address</label>
                  <input
                    type="text"
                    placeholder="G..."
                    className="form-control"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value.trim())}
                    required
                    style={{ fontFamily: "monospace", fontSize: "0.82rem" }}
                  />
                </div>

                {/* Amount & Available Balance */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Amount (XLM)</label>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--role-accent)", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer" }}
                        onClick={() => setPayAmount(xlmBalance)}
                      >
                        Max: {xlmBalance}
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.0000001"
                      placeholder="0.00"
                      className="form-control"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Estimated Value</label>
                    <div
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "10px",
                        padding: "0.65rem 0.85rem",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      ≈ {formatXlmToPhp(parseFloat(payAmount) || 0)}
                    </div>
                  </div>
                </div>

                {/* Memo (Optional) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Transaction Memo (Optional, max 28 chars)</label>
                  <input
                    type="text"
                    maxLength={28}
                    placeholder="e.g. Budget Audit, SK Support"
                    className="form-control"
                    value={payMemo}
                    onChange={(e) => setPayMemo(e.target.value)}
                  />
                </div>

                {sendError && (
                  <div style={{ background: "var(--accent-danger-soft)", border: "1px solid var(--accent-danger)", borderRadius: "10px", padding: "0.75rem", color: "var(--accent-danger)", fontSize: "0.8rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <AlertCircle size={16} />
                    <span>{sendError}</span>
                  </div>
                )}

                {sendSuccessTx && (
                  <div style={{ background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)", borderRadius: "14px", padding: "1rem", color: "var(--accent-green)", fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 800, fontSize: "0.9rem" }}>
                      <ShieldCheck size={18} /> Payment Confirmed & Sealed on Stellar Ledger!
                    </div>
                    <div style={{ fontSize: "0.75rem", wordBreak: "break-all", color: "var(--text-secondary)" }}>
                      TxID: <a href={`https://stellar.expert/explorer/testnet/tx/${sendSuccessTx}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-green)", textDecoration: "underline", fontWeight: 700 }}>{sendSuccessTx} <ExternalLink size={12} style={{ display: "inline" }} /></a>
                    </div>
                    {lastSentReceiptData && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm tap-scale"
                        onClick={async () => {
                          setIsGeneratingPdf(true);
                          try {
                            await generatePaymentReceiptPdf(lastSentReceiptData);
                          } finally {
                            setIsGeneratingPdf(false);
                          }
                        }}
                        disabled={isGeneratingPdf}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.45rem", marginTop: "0.25rem", height: "40px", borderRadius: "12px", fontWeight: 800, background: "var(--accent-green)", color: "#0f172a", border: "none" }}
                      >
                        <FileText size={16} />
                        <span>{isGeneratingPdf ? "Generating PDF Receipt..." : "📄 Download Official PDF Receipt"}</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-100 tap-scale"
                  disabled={isSending}
                  style={{ height: "50px", marginTop: "0.5rem" }}
                >
                  {isSending ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                      <RefreshCw size={16} className="animate-spin" /> Broadcasting Transfer...
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                      <ArrowUpRight size={16} /> Confirm & Send Payment
                    </span>
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default QrModal;
