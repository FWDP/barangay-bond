/**
 * Currency Utility for Barangay Bond
 * Converts Stellar (XLM) amounts to Philippine Peso (₱ / PHP) equivalents for resident transparency.
 * Connects to live CoinGecko API with cached fallback.
 */

const CACHE_KEY = "barangay_bond_xlm_php_rate";
const CACHE_TIME_KEY = "barangay_bond_xlm_php_rate_time";
const FIVE_MINUTES_MS = 5 * 60 * 1000;

// Fallback reference rate if offline or rate limited (set to 0 to prevent inaccurate hardcoded rates)
export let XLM_TO_PHP_RATE = 0;

/**
 * Synchronously get current active exchange rate
 */
export function getXlmToPhpRate(): number {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = parseFloat(cached);
      if (!isNaN(parsed) && parsed > 0) {
        XLM_TO_PHP_RATE = parsed;
      }
    }
  } catch (e) {
    // Ignore SSR/localStorage error
  }
  return XLM_TO_PHP_RATE;
}

/**
 * Asynchronously fetch real-time live XLM to PHP exchange rate from CoinGecko API,
 * with automatic fallback to Coinbase Spot Price API if CoinGecko is offline/rate-limited.
 */
export async function fetchLiveXlmRate(): Promise<number> {
  const now = Date.now();
  const lastFetch = localStorage.getItem(CACHE_TIME_KEY);
  
  // Cache for 5 minutes
  if (lastFetch && now - parseInt(lastFetch, 10) < FIVE_MINUTES_MS) {
    const rate = getXlmToPhpRate();
    if (rate > 0) return rate;
  }

  // 1. Try CoinGecko API
  try {
    console.log("🌐 [Currency Engine] Fetching live XLM-to-PHP rate from CoinGecko API...");
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php,usd",
      { cache: "no-cache" }
    );

    if (res.ok) {
      const data = await res.json();
      const liveRate = data?.stellar?.php;
      if (typeof liveRate === "number" && liveRate > 0) {
        XLM_TO_PHP_RATE = liveRate;
        localStorage.setItem(CACHE_KEY, liveRate.toString());
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
        console.log(`✅ [Currency Engine] Live Stellar Rate Updated: 1 XLM = ₱${liveRate.toFixed(2)} PHP`);
        return liveRate;
      }
    }
  } catch (geckoErr) {
    console.warn("⚠️ [Currency Engine] CoinGecko fetch failed, attempting Coinbase fallback...", geckoErr);
  }

  // 2. Try Coinbase Spot Price API as reliable secondary source
  try {
    console.log("🌐 [Currency Engine] Fetching live XLM-to-PHP rate from Coinbase API...");
    const cbRes = await fetch(
      "https://api.coinbase.com/v2/prices/XLM-PHP/spot",
      { cache: "no-cache" }
    );

    if (cbRes.ok) {
      const cbData = await cbRes.json();
      const liveRate = parseFloat(cbData?.data?.amount);
      if (typeof liveRate === "number" && !isNaN(liveRate) && liveRate > 0) {
        XLM_TO_PHP_RATE = liveRate;
        localStorage.setItem(CACHE_KEY, liveRate.toString());
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
        console.log(`✅ [Currency Engine] Live Stellar Rate Updated (Coinbase): 1 XLM = ₱${liveRate.toFixed(2)} PHP`);
        return liveRate;
      }
    }
  } catch (cbErr) {
    console.warn("⚠️ [Currency Engine] Coinbase fetch failed...", cbErr);
  }

  // If both APIs failed and there is no cached rate
  const finalRate = getXlmToPhpRate();
  if (finalRate <= 0) {
    console.error("❌ [Currency Engine] Crucial exchange rate fetch failed from all providers and no cache exists.");
  }
  return finalRate;
}

/**
 * Convert XLM amount to Philippine Peso (PHP)
 */
export function xlmToPhp(xlm: number | string): number {
  const numericXlm = typeof xlm === "string" ? parseFloat(xlm) || 0 : xlm;
  return numericXlm * getXlmToPhpRate();
}

/**
 * Convert PHP amount to Stellar (XLM)
 */
export function phpToXlm(php: number | string): number {
  const numericPhp = typeof php === "string" ? parseFloat(php) || 0 : php;
  const rate = getXlmToPhpRate();
  return rate > 0 ? numericPhp / rate : 0;
}

/**
 * Format PHP currency string with peso sign (₱) and commas (e.g. ₱1,500.00)
 */
export function formatPhp(amountInPhp: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInPhp);
}

/**
 * Format XLM with corresponding live PHP value in parentheses
 * Guarded against offline/0 rate conversions.
 */
export function formatXlmWithPhp(xlm: number | string): { xlmStr: string; phpStr: string; combined: string } {
  const numericXlm = typeof xlm === "string" ? parseFloat(xlm) || 0 : xlm;
  const rate = getXlmToPhpRate();
  const xlmFormatted = `${numericXlm.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} XLM`;

  if (rate <= 0) {
    return {
      xlmStr: xlmFormatted,
      phpStr: "₱--- (Rate Offline)",
      combined: `${xlmFormatted} (₱--- Rate Offline)`,
    };
  }

  const phpValue = numericXlm * rate;
  const phpFormatted = formatPhp(phpValue);

  return {
    xlmStr: xlmFormatted,
    phpStr: phpFormatted,
    combined: `${xlmFormatted} (≈ ${phpFormatted})`,
  };
}

/**
 * Safe conversion and formatting from XLM to PHP.
 * Returns formatted PHP or "₱--- (Rate Offline)" if exchange rate is offline.
 */
export function formatXlmToPhp(xlm: number | string): string {
  const numericXlm = typeof xlm === "string" ? parseFloat(xlm) || 0 : xlm;
  const rate = getXlmToPhpRate();
  if (rate <= 0) return "₱--- (Rate Offline)";
  return formatPhp(numericXlm * rate);
}
