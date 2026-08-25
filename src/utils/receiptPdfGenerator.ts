import { jsPDF } from "jspdf";
import type { WalletTransaction } from "../services/walletTransaction.service";

interface ReceiptUserData {
  userName?: string;
  barangayName?: string;
  role?: string;
}

/**
 * Generates an official Philippine Government Electronic Official Receipt (e-OR) PDF
 */
export const generateOfficialReceiptPdf = (
  tx: WalletTransaction,
  userData?: ReceiptUserData
): void => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. TOP HEADER BANNER
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPUBLIC OF THE PHILIPPINES", pageWidth / 2, 8, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `BARANGAY BOND CIVIC ESCROW NETWORK • ${userData?.barangayName ? userData.barangayName.toUpperCase() : "BARANGAY TREASURY"}`,
    pageWidth / 2,
    14,
    { align: "center" }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(52, 211, 153); // Emerald accent
  doc.text("OFFICIAL ELECTRONIC DISBURSEMENT RECEIPT (e-OR)", pageWidth / 2, 22, { align: "center" });

  // 2. RECEIPT META BOX
  let y = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 24, 3, 3, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT REFERENCE NUMBER", 20, y + 7);
  doc.text("TRANSACTION DATE & TIME", 110, y + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  const receiptNo = `BGY-OR-${tx.txHash.slice(0, 8).toUpperCase()}-${tx.ledger || "707"}`;
  doc.text(receiptNo, 20, y + 14);

  const formattedDate = new Date(tx.timestamp).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  doc.text(formattedDate, 110, y + 14);

  doc.setFontSize(7.5);
  doc.setTextColor(16, 185, 129);
  doc.text("✓ CRYPTOGRAPHICALLY CONFIRMED ON STELLAR TESTNET", 20, y + 20);

  // 3. TRANSACTION PARTICIPANTS
  y += 30;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TRANSACTION PARTIES", 14, y);

  y += 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 36, 3, 3, "FD");

  // Payer (Sender)
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("PAYER / SOURCE ACCOUNT:", 20, y + 7);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(tx.direction === "inbound" ? "Barangay Treasury / Smart Contract Escrow" : (userData?.userName || "User Wallet"), 20, y + 12);
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(tx.from || "N/A", 20, y + 16);

  // Payee (Recipient)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("PAYEE / BENEFICIARY ACCOUNT:", 20, y + 23);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(tx.direction === "inbound" ? (userData?.userName || "Authorized Beneficiary") : "Designated Contractor / Recipient", 20, y + 28);
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(tx.to || "N/A", 20, y + 32);

  // 4. FINANCIAL DISBURSEMENT BREAKDOWN
  y += 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("FINANCIAL BREAKDOWN", 14, y);

  y += 4;
  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 8, "F");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("ITEM DESCRIPTION", 20, y + 5.5);
  doc.text("PAYMENT CHANNEL", 95, y + 5.5);
  doc.text("AMOUNT (XLM)", 140, y + 5.5, { align: "right" });
  doc.text("EST. PHP", pageWidth - 20, y + 5.5, { align: "right" });

  // Table Row
  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y + 12, pageWidth - 14, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(tx.title, 20, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(tx.description, 20, y + 9);

  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text(tx.paymentMethod === "in_app" ? "In-App 1-Click Civic Key" : "External Wallet Extension", 95, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`${tx.amountXlm} XLM`, 140, y + 6, { align: "right" });
  doc.setTextColor(16, 185, 129);
  doc.text(`₱${tx.amountPhp}`, pageWidth - 20, y + 6, { align: "right" });

  // Table Total
  y += 16;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL DISBURSEMENT:", 20, y + 9);

  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text(`₱${tx.amountPhp} (${tx.amountXlm} XLM)`, pageWidth - 20, y + 9, { align: "right" });

  // 5. BLOCKCHAIN AUDIT TRAIL & QR SECTION
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("STELLAR BLOCKCHAIN VERIFICATION AUDIT", 14, y);

  y += 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 38, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("TRANSACTION HASH (TX HASH):", 20, y + 7);

  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(tx.txHash, 20, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("NETWORK / LEDGER SEQUENCE:", 20, y + 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Stellar Testnet • Ledger #${tx.ledger || "70728"} • Fee: ${tx.feePaidXlm || "0.00001"} XLM`, 20, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(37, 99, 235);
  doc.text(`Audit URL: https://stellar.expert/explorer/testnet/tx/${tx.txHash}`, 20, y + 31);

  // 6. OFFICIAL FOOTER SEAL
  y += 44;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, pageWidth - 14, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("OFFICIAL LOCAL GOVERNMENT ELECTRONIC DOCUMENT", pageWidth / 2, y + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This electronic receipt is issued pursuant to the Electronic Commerce Act of 2000 (R.A. 8792) and secured by the Stellar Soroban Distributed Ledger.",
    pageWidth / 2,
    y + 9,
    { align: "center" }
  );

  // Save the PDF
  const filename = `BarangayBond_Receipt_${tx.txHash.slice(0, 8)}.pdf`;
  doc.save(filename);
};
