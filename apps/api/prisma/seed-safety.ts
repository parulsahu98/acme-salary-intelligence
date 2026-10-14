import type { Currency, EmploymentStatus } from "@prisma/client";

export interface SyntheticEmployee {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  country: string;
  currency: Currency;
  status: EmploymentStatus;
  currentSalary: string;
}

export type ExistingEmployee = SyntheticEmployee;

export interface ExistingSalaryRevision {
  id: string;
  employeeId: string;
  previousSalary: string | null;
  newSalary: string;
  currency: string;
  reason: string | null;
}

const allowedDatabaseNames = new Set(["acme_salary", "acme_salary_test"]);
const allowedLocalHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertSeedConfiguration(
  environment: NodeJS.ProcessEnv,
): string {
  if (
    environment.NODE_ENV !== "development" &&
    environment.NODE_ENV !== "test"
  ) {
    throw new Error(
      "Synthetic seed requires NODE_ENV=development or NODE_ENV=test.",
    );
  }
  if (environment.SEED_SYNTHETIC_DATA !== "YES") {
    throw new Error(
      "Set SEED_SYNTHETIC_DATA=YES to explicitly opt in to synthetic seeding.",
    );
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for synthetic seeding.");
  }
  if (!environment.SEED_ALLOWED_DATABASE_URL) {
    throw new Error(
      "SEED_ALLOWED_DATABASE_URL must explicitly allow the target database.",
    );
  }
  if (databaseUrl !== environment.SEED_ALLOWED_DATABASE_URL) {
    throw new Error(
      "DATABASE_URL does not exactly match SEED_ALLOWED_DATABASE_URL.",
    );
  }

  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (target.protocol !== "postgresql:" && target.protocol !== "postgres:") {
    throw new Error("Synthetic seeding only supports PostgreSQL targets.");
  }
  if (!allowedLocalHosts.has(target.hostname)) {
    throw new Error(
      "Synthetic seeding is restricted to localhost PostgreSQL targets.",
    );
  }
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!allowedDatabaseNames.has(databaseName)) {
    throw new Error(
      "Synthetic seeding is restricted to acme_salary or acme_salary_test.",
    );
  }
  if (
    target.searchParams.has("schema") &&
    target.searchParams.get("schema") !== "public"
  ) {
    throw new Error("Synthetic seeding is restricted to the public schema.");
  }

  return databaseUrl;
}

function normalizeDecimal(value: string): string {
  const [whole = "0", fraction = ""] = value.split(".");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction
    ? `${BigInt(whole)}.${normalizedFraction}`
    : BigInt(whole).toString();
}

export function assertSeedDatabaseSafe(
  expectedEmployees: readonly SyntheticEmployee[],
  existingEmployees: readonly ExistingEmployee[],
  existingRevisions: readonly ExistingSalaryRevision[],
  userCount: number,
): boolean {
  if (
    existingEmployees.length === 0 &&
    existingRevisions.length === 0 &&
    userCount === 0
  ) {
    return true;
  }

  if (userCount !== 0) {
    throw new Error("Seed target contains user accounts; refusing to write.");
  }
  if (
    existingEmployees.length !== expectedEmployees.length ||
    existingRevisions.length !== expectedEmployees.length
  ) {
    throw new Error(
      "Seed target is neither empty nor the complete expected synthetic dataset; refusing to write.",
    );
  }

  const expectedById = new Map(
    expectedEmployees.map((employee) => [employee.id, employee]),
  );
  if (expectedById.size !== expectedEmployees.length) {
    throw new Error(
      "Expected synthetic dataset contains duplicate employee IDs.",
    );
  }

  const actualEmployeesById = new Map(
    existingEmployees.map((employee) => [employee.id, employee]),
  );
  if (actualEmployeesById.size !== existingEmployees.length) {
    throw new Error(
      "Seed target contains duplicate employee IDs; refusing to write.",
    );
  }
  for (const [id, expected] of expectedById) {
    const actual = actualEmployeesById.get(id);
    if (
      !actual ||
      actual.employeeNumber !== expected.employeeNumber ||
      actual.fullName !== expected.fullName ||
      actual.email !== expected.email ||
      actual.department !== expected.department ||
      actual.jobTitle !== expected.jobTitle ||
      actual.country !== expected.country ||
      actual.currency !== expected.currency ||
      actual.status !== expected.status ||
      normalizeDecimal(actual.currentSalary) !==
        normalizeDecimal(expected.currentSalary)
    ) {
      throw new Error(
        "Seed target contains employee data outside the expected synthetic dataset.",
      );
    }
  }

  const expectedRevisions = new Map(
    expectedEmployees.map((employee) => [
      `synthetic-revision-${employee.employeeNumber}`,
      employee,
    ]),
  );
  const actualRevisionsById = new Map(
    existingRevisions.map((revision) => [revision.id, revision]),
  );
  if (actualRevisionsById.size !== existingRevisions.length) {
    throw new Error(
      "Seed target contains duplicate salary revision IDs; refusing to write.",
    );
  }
  for (const [id, employee] of expectedRevisions) {
    const actual = actualRevisionsById.get(id);
    if (
      !actual ||
      actual.employeeId !== employee.id ||
      actual.previousSalary !== null ||
      normalizeDecimal(actual.newSalary) !==
        normalizeDecimal(employee.currentSalary) ||
      actual.currency !== employee.currency ||
      actual.reason !== "Initial synthetic record"
    ) {
      throw new Error(
        "Seed target contains salary history outside the expected synthetic dataset.",
      );
    }
  }

  return false;
}
