export function normalizeName(name: string): string {
  if (!name) return "";
  
  const formatWord = (word: string): string => {
    // Preserve initials like J.P., A.B.
    if (/^[A-Za-z]\.[A-Za-z]\.?$/.test(word)) {
      return word.toUpperCase();
    }
    // Handle hyphenated names like Jean-Paul
    if (word.includes("-")) {
      return word.split("-").map(formatWord).join("-");
    }
    // Standard capitalization: first char uppercase, rest lowercase
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  };

  return name
    .trim()
    .split(/\s+/)
    .map(formatWord)
    .join(" ");
}

export function normalizeAddress(address: string): string {
  if (!address) return "";
  return address
    .toLowerCase()
    .replace(/\bbrgy\.?\b/g, "barangay")
    .replace(/\bst\.?\b/g, "street")
    .replace(/\brd\.?\b/g, "road")
    .replace(/\bave\.?\b/g, "avenue")
    .replace(/\bblvd\.?\b/g, "boulevard")
    .replace(/\bhwy\.?\b/g, "highway")
    .replace(/\bsitio\.?\b/g, "sitio")
    .replace(/\bpurok\.?\b/g, "purok")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMobileNumber(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, ""); // extract only digits
  if (digits.startsWith("0")) {
    digits = "63" + digits.slice(1);
  }
  if (!digits.startsWith("63") && digits.length === 10) {
    digits = "63" + digits;
  }
  return "+" + digits;
}

export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.toLowerCase().replace(/\s+/g, "");
}
