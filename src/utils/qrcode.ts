/**
 * Pure TypeScript self-contained QR Code Generator & SEP-0007 Stellar URI parser.
 */

export function generateQrUrl(text: string, size: number = 260): string {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8&qzone=1`;
}

/**
 * Format a Stellar payment URI scheme (SEP-0007 compliant)
 */
export function formatStellarPaymentUri(destination: string, amount?: string, memo?: string): string {
  let uri = `web+stellar:pay?destination=${encodeURIComponent(destination)}`;
  if (amount && Number(amount) > 0) {
    uri += `&amount=${encodeURIComponent(amount)}`;
  }
  if (memo && memo.trim()) {
    uri += `&memo=${encodeURIComponent(memo.trim())}&memo_type=MEMO_TEXT`;
  }
  return uri;
}

/**
 * Parse a scanned string into Stellar address and amount if available.
 */
export function parseScannedStellarQr(data: string): { address: string; amount?: string; memo?: string } {
  const trimmed = data.trim();

  // If raw Stellar public address
  if (trimmed.startsWith("G") && trimmed.length === 56) {
    return { address: trimmed };
  }

  // If SEP-0007 URI
  if (trimmed.startsWith("web+stellar:pay") || trimmed.startsWith("stellar:pay")) {
    try {
      const url = new URL(trimmed.replace(/^web\+/, ""));
      const destination = url.searchParams.get("destination") || "";
      const amount = url.searchParams.get("amount") || undefined;
      const memo = url.searchParams.get("memo") || undefined;
      return { address: destination, amount, memo };
    } catch {
      const destMatch = trimmed.match(/destination=([A-Z0-9]{56})/);
      const amtMatch = trimmed.match(/amount=([0-9.]+)/);
      const memoMatch = trimmed.match(/memo=([^&]+)/);
      return {
        address: destMatch ? destMatch[1] : trimmed,
        amount: amtMatch ? amtMatch[1] : undefined,
        memo: memoMatch ? decodeURIComponent(memoMatch[1]) : undefined,
      };
    }
  }

  return { address: trimmed };
}
