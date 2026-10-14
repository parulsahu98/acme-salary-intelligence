export const currencyFractionDigits = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  CAD: 2,
  AUD: 2,
  SGD: 2,
  JPY: 0,
  BHD: 3,
} as const;

export type SupportedCurrency = keyof typeof currencyFractionDigits;

const SALARY_SCALE = 10_000n;

export function isValidSalary(
  value: string,
  currency: SupportedCurrency,
): boolean {
  const digits = currencyFractionDigits[currency];
  const pattern =
    digits === 0
      ? /^\d{1,15}$/
      : new RegExp(`^\\d{1,15}(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(value)) return false;
  return BigInt(value.replace(".", "")) > 0n;
}

function toScaledMoney(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * SALARY_SCALE + BigInt(fraction.padEnd(4, "0"));
}

function fromScaledMoney(value: bigint, currency: SupportedCurrency): string {
  const fractionDigits = currencyFractionDigits[currency];
  const roundingUnit = 10n ** BigInt(4 - fractionDigits);
  const rounded = ((value + roundingUnit / 2n) / roundingUnit) * roundingUnit;
  const whole = rounded / SALARY_SCALE;
  if (fractionDigits === 0) return whole.toString();
  const fraction = (rounded % SALARY_SCALE)
    .toString()
    .padStart(4, "0")
    .slice(0, fractionDigits);
  return `${whole}.${fraction}`;
}

export function salaryDistribution(
  values: readonly string[],
  currency: SupportedCurrency,
) {
  if (values.length === 0) {
    return { median: null, bands: { lower: 0, middle: 0, upper: 0 } };
  }
  const sorted = values
    .map(toScaledMoney)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  const medianValue =
    sorted.length % 2 === 1
      ? sorted[middle]!
      : (sorted[middle - 1]! + sorted[middle]!) / 2n;
  const lowerQuartile = sorted[Math.floor((sorted.length - 1) * 0.25)]!;
  const upperQuartile = sorted[Math.floor((sorted.length - 1) * 0.75)]!;
  const bands = { lower: 0, middle: 0, upper: 0 };
  for (const value of sorted) {
    if (value <= lowerQuartile) bands.lower += 1;
    else if (value <= upperQuartile) bands.middle += 1;
    else bands.upper += 1;
  }
  return { median: fromScaledMoney(medianValue, currency), bands };
}
