/* Visitor's currency, for showing subscription prices in local money.
   No network lookup: the country comes from the browser's time zone (most reliable for
   India) and language region, then maps to a currency. Unknown → USD. */

const TZ_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Europe/London": "GB",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "Asia/Dubai": "AE",
  "Asia/Singapore": "SG",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "America/Toronto": "CA",
  "Asia/Dhaka": "BD",
  "Asia/Karachi": "PK",
  "Asia/Kathmandu": "NP",
  "Asia/Colombo": "LK",
};

const EURO = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  AE: "AED",
  SG: "SGD",
  AU: "AUD",
  CA: "CAD",
  BD: "BDT",
  PK: "PKR",
  NP: "NPR",
  LK: "LKR",
  JP: "JPY",
  ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
};

export function detectCountry(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    if (tz?.startsWith("Europe/")) {
      // Most of Europe uses the euro; the language region refines it below.
    }
  } catch {
    /* ignore */
  }
  const langs = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const l of langs) {
    const region = l?.split("-")[1];
    if (region && region.length === 2) return region.toUpperCase();
  }
  return null;
}

/** Best currency for this visitor among the ones we have prices for. */
export function pickCurrency(available: string[]): string {
  const country = detectCountry();
  const wanted = country ? COUNTRY_CURRENCY[country] : undefined;
  if (wanted && available.includes(wanted)) return wanted;
  return available.includes("USD") ? "USD" : (available[0] ?? "USD");
}

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export const formatTokens = (n: number) => new Intl.NumberFormat().format(n);
