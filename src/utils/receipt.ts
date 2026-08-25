import { jsPDF } from "jspdf";
import { formatXlmToPhp } from "./currency";

export interface ReceiptData {
  txHash: string;
  senderAddress: string;
  recipientAddress: string;
  amountXlm: string;
  memo?: string;
  timestamp?: string;
  senderName?: string;
  barangayName?: string;
}

/**
 * Generates an official, immutable cryptographic PDF receipt for a Stellar transaction.
 */
export async function generatePaymentReceiptPdf(data: ReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryColor = [0, 180, 85]; // Emerald #00b455
  const darkBg = [15, 23, 42]; // Slate 900
  const textColor = [30, 41, 59]; // Slate 800
  const mutedColor = [100, 116, 139]; // Slate 500
  const lightGray = [241, 245, 249]; // Slate 100
  const borderColor = [226, 232, 240]; // Slate 200

  const numAmount = parseFloat(data.amountXlm) || 0;
  const phpEquivalent = formatXlmToPhp(numAmount);
  const now = data.timestamp ? new Date(data.timestamp) : new Date();
  const formattedDate = now.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }) + " (PHT)";
  const receiptSerial = `BGY-${data.txHash.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  // 1. Top Emerald Accent Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 8, "F");

  // 2. Header Box & Logo Emblem
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("BARANGAY BOND", 20, 24);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text("Decentralized Civic Treasury & Escrow Ledger", 20, 29);
  doc.text("Republic of the Philippines • Stellar Soroban Network", 20, 34);

  // Status Badge (Top Right)
  doc.setFillColor(236, 253, 245); // Light emerald bg
  doc.roundedRect(140, 16, 50, 14, 3, 3, "F");
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(140, 16, 50, 14, 3, 3, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("● CONFIRMED ON LEDGER", 143, 24.5);

  // Divider Line
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.line(20, 42, 190, 42);

  // 3. Amount Hero Card Frame
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.roundedRect(20, 48, 170, 36, 4, 4, "F");
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(20, 48, 170, 36, 4, 4, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text("TRANSFER AMOUNT", 28, 57);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text(`${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} XLM`, 28, 68);

  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`≈ ${phpEquivalent} (PHP Fiat Value)`, 28, 77);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text(`Receipt Serial: ${receiptSerial}`, 120, 57);

  // 4. Transaction Metadata Table
  let y = 96;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("Cryptographic Transaction Details", 20, y);
  y += 6;

  const renderDetailRow = (label: string, value: string, isMono = false, isHighlight = false) => {
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.2);
    doc.line(20, y + 2, 190, y + 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(label, 20, y);

    doc.setFont(isMono ? "courier" : "helvetica", isHighlight ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(isHighlight ? primaryColor[0] : textColor[0], isHighlight ? primaryColor[1] : textColor[1], isHighlight ? primaryColor[2] : textColor[2]);

    // Handle multiline text (e.g. 56-char public keys or 64-char hashes)
    const splitText = doc.splitTextToSize(value, 110);
    doc.text(splitText, 80, y);

    y += Math.max(splitText.length * 4.5, 7.5);
  };

  renderDetailRow("Date & Timestamp", formattedDate);
  renderDetailRow("Consensus Network", "Stellar Soroban Testnet");
  renderDetailRow("Sender (Origin)", data.senderAddress, true);
  renderDetailRow("Recipient (Destination)", data.recipientAddress, true);
  if (data.senderName) {
    renderDetailRow("Sender Identity", `${data.senderName} (${data.barangayName ? `Brgy. ${data.barangayName}` : "Citizen"})`);
  }
  renderDetailRow("Transaction Hash (TxID)", data.txHash, true, true);
  renderDetailRow("Network Ledger Fee", "0.0001000 XLM (100 stroops)");
  if (data.memo) {
    renderDetailRow("Transaction Memo / Note", data.memo);
  }

  // 5. Verification QR Code & Blockchain Seal Box
  y += 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, y, 170, 48, 4, 4, "F");
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(20, y, 170, 48, 4, 4, "S");

  // Generate Explorer QR Code image
  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${data.txHash}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(explorerUrl)}&format=png`;

  try {
    const imgBlob = await fetch(qrImgUrl).then((r) => r.blob());
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(imgBlob);
    });
    doc.addImage(base64Data, "PNG", 26, y + 6, 36, 36);
  } catch (qrErr) {
    console.warn("Could not load QR code image for PDF, continuing with text seal:", qrErr);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.text("IMMUTABLE LEDGER VERIFICATION", 68, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("Scan QR code or click the explorer link to audit", 68, y + 20);
  doc.text("this transaction directly on the public Stellar Explorer:", 68, y + 25);

  doc.setFont("courier", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 112, 224); // Blue link
  doc.textWithLink("stellar.expert/explorer/testnet/tx/...", 68, y + 33, { url: explorerUrl });

  // 6. Security Notice & Footer Watermark
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  const disclaimer =
    "NOTICE: This document is an immutable cryptographic receipt generated by Barangay Bond Civic Treasury. State verification is guaranteed by decentralized Byzantine agreement consensus on the Stellar Network.";
  doc.text(doc.splitTextToSize(disclaimer, 170), 20, 274);

  // Save and Trigger Download
  const filename = `BarangayBond_Receipt_${data.txHash.slice(0, 8)}_${Date.now()}.pdf`;
  doc.save(filename);
}
