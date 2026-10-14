const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");

export interface ApiError extends Error {
  status: number;
}

export async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "object" &&
      data.error !== null &&
      "message" in data.error
        ? String(data.error.message)
        : `Request failed with status ${response.status}.`;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    throw error;
  }
  return data as T;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  country: string;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  currentSalary: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRevision {
  id: string;
  previousSalary: string | null;
  newSalary: string;
  currency: string;
  effectiveAt: string;
  reason: string | null;
}

export interface Analytics {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  byDepartment: Array<{
    department: string;
    currency: string;
    employeeCount: number;
    averageSalary: string | null;
  }>;
  byCountry: Array<{
    country: string;
    currency: string;
    employeeCount: number;
    averageSalary: string | null;
  }>;
  salarySummary: Array<{
    currency: string;
    employeeCount: number;
    average: string | null;
    minimum: string | null;
    maximum: string | null;
    median: string | null;
    salaryBands: { lower: number; middle: number; upper: number };
  }>;
}

export function formatMoney(amount: string | number, currency: string): string {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const [whole = "0", fraction = ""] = String(amount).split(".");
  const factor = 10 ** fractionDigits;
  const retained = fraction
    .slice(0, fractionDigits)
    .padEnd(fractionDigits, "0");
  let minorUnits = BigInt(whole) * BigInt(factor) + BigInt(retained || "0");
  if (fraction.length > fractionDigits && Number(fraction[fractionDigits]) >= 5)
    minorUnits += 1n;
  const localizedParts = formatter.formatToParts(minorUnits / BigInt(factor));
  const decimalSeparator =
    localizedParts.find((part) => part.type === "decimal")?.value ?? ".";
  const localizedFraction = fractionDigits
    ? new Intl.NumberFormat(undefined, {
        useGrouping: false,
        minimumIntegerDigits: fractionDigits,
        maximumFractionDigits: 0,
      }).format(Number(minorUnits % BigInt(factor)))
    : "";
  return localizedParts
    .map((part) =>
      part.type === "decimal"
        ? decimalSeparator
        : part.type === "fraction"
          ? localizedFraction
          : part.value,
    )
    .join("");
}
