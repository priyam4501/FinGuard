/**
 * Currency formatting for FinGuard.
 *
 * Each group carries an ISO-4217 currency code (INR by default). Always
 * format through this util so display stays consistent — never render raw
 * numbers or hardcode a `$`.
 */

export const SUPPORTED_CURRENCIES = [
  { code: "INR", label: "₹ Indian Rupee (INR)", symbol: "₹" },
  { code: "USD", label: "$ US Dollar (USD)", symbol: "$" },
  { code: "EUR", label: "€ Euro (EUR)", symbol: "€" },
  { code: "GBP", label: "£ British Pound (GBP)", symbol: "£" },
  { code: "JPY", label: "¥ Japanese Yen (JPY)", symbol: "¥" },
  { code: "AED", label: "د.إ UAE Dirham (AED)", symbol: "د.إ" },
  { code: "AUD", label: "A$ Australian Dollar (AUD)", symbol: "A$" },
  { code: "CAD", label: "C$ Canadian Dollar (CAD)", symbol: "C$" },
  { code: "SGD", label: "S$ Singapore Dollar (SGD)", symbol: "S$" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "INR";

/** Locale hint per currency — matters for grouping (e.g. Indian lakh grouping). */
const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  JPY: "ja-JP",
  AED: "en-AE",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
};

/** Zero-decimal currencies per ISO-4217. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP"]);

/**
 * Format a numeric amount as a currency string.
 * Defaults to INR when no currency is provided.
 */
export function formatCurrency(
  amount: number,
  currency: string | null | undefined = DEFAULT_CURRENCY,
): string {
  const code = (currency ?? DEFAULT_CURRENCY).toUpperCase();
  const locale = LOCALE_BY_CURRENCY[code] ?? "en-US";
  const fractionDigits = ZERO_DECIMAL.has(code) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    // Fallback if the runtime rejects the currency code
    return `${code} ${amount.toFixed(fractionDigits)}`;
  }
}

/** Round to 2 decimals safely (avoid float drift in intermediate math). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
