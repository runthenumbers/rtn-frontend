export const currencies = [
  { code: "AUD", name: "Australian dollar", symbol: "$" },
  { code: "CAD", name: "Canadian dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British pound", symbol: "£" },
  { code: "GHS", name: "Ghanaian cedi", symbol: "₵" },
  { code: "KES", name: "Kenyan shilling", symbol: "KSh" },
  { code: "NGN", name: "Nigerian naira", symbol: "₦" },
  { code: "USD", name: "United States dollar", symbol: "$" },
  { code: "ZAR", name: "South African rand", symbol: "R" },
] as const;

export type CurrencyCode = (typeof currencies)[number]["code"];

const supportedCurrencyCodes = new Set<string>(
  currencies.map((currency) => currency.code),
);

export function isCurrencyCode(value: string): value is CurrencyCode {
  return supportedCurrencyCodes.has(value);
}

// Format decimal strings without converting money to floating point. Display
// rounding remains half-expand, matching Intl's default, and is never used as
// an input to the engine or to dashboard aggregation.
function formatMoney(amount: string, currency: string, places: number) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new Error("Expected a decimal monetary string.");
  const fraction = match[3] ?? "";
  const scale = 10n ** BigInt(places);
  let rounded =
    BigInt(match[2]) * scale +
    BigInt(fraction.slice(0, places).padEnd(places, "0"));
  if ((fraction[places] ?? "0") >= "5") rounded++;
  const whole = rounded / scale;
  const formattedFraction = (rounded % scale)
    .toString()
    .padStart(places, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  const negative = match[1] === "-";
  const signed = negative ? (whole === 0n ? -0 : -whole) : whole;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(signed)
    .map((part) => (part.type === "fraction" ? formattedFraction : part.value))
    .join("");
}
export function formatCurrencyDecimal(amount: string, currency: string) {
  return formatMoney(amount, currency, 2);
}
export function formatUnitCostDecimal(amount: string, currency: string) {
  return formatMoney(amount, currency, 4);
}
