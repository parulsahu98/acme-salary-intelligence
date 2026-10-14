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

export interface SeedMigrationRecord {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

export interface SeedColumnRecord {
  table_name: string;
  column_name: string;
  udt_name: string;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export interface SeedTarget {
  databaseUrl: string;
  kind: "local" | "neon";
}

const allowedDatabaseNames = new Set(["acme_salary", "acme_salary_test"]);
const allowedLocalHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertSeedConfiguration(
  environment: NodeJS.ProcessEnv,
): SeedTarget {
  if (
    environment.NODE_ENV !== "development" &&
    environment.NODE_ENV !== "test" &&
    environment.NODE_ENV !== "production"
  ) {
    throw new Error(
      "Set NODE_ENV to development, test, or production before seeding.",
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
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (
    target.searchParams.has("schema") &&
    target.searchParams.get("schema") !== "public"
  ) {
    throw new Error("Synthetic seeding is restricted to the public schema.");
  }

  if (
    environment.NODE_ENV === "development" ||
    environment.NODE_ENV === "test"
  ) {
    if (!allowedLocalHosts.has(target.hostname)) {
      throw new Error(
        "Development/test seeding is restricted to localhost PostgreSQL targets.",
      );
    }
    if (!allowedDatabaseNames.has(databaseName)) {
      throw new Error(
        "Development/test seeding is restricted to acme_salary or acme_salary_test.",
      );
    }
    return { databaseUrl, kind: "local" };
  }

  if (
    environment.NODE_ENV !== "production" ||
    environment.SEED_NEON_ONCE !== "YES"
  ) {
    throw new Error(
      "Remote seeding requires NODE_ENV=production and SEED_NEON_ONCE=YES.",
    );
  }

  const expectedHost = environment.SEED_ALLOWED_NEON_HOST;
  const expectedDatabase = environment.SEED_ALLOWED_NEON_DATABASE;
  if (!expectedHost || !expectedDatabase) {
    throw new Error(
      "SEED_ALLOWED_NEON_HOST and SEED_ALLOWED_NEON_DATABASE are required for Neon seeding.",
    );
  }
  if (
    !target.hostname.endsWith(".neon.tech") ||
    target.hostname !== expectedHost
  ) {
    throw new Error(
      "DATABASE_URL host does not match the explicitly approved Neon endpoint.",
    );
  }
  if (databaseName !== expectedDatabase) {
    throw new Error(
      "DATABASE_URL database does not match the explicitly approved Neon database.",
    );
  }

  return { databaseUrl, kind: "neon" };
}

export function assertSeedMigrationsCurrent(
  expectedMigrations: readonly string[],
  records: readonly SeedMigrationRecord[],
): void {
  const expected = new Set(expectedMigrations);
  if (expected.size !== expectedMigrations.length || expected.size === 0) {
    throw new Error(
      "Local Prisma migration history is invalid; refusing to seed.",
    );
  }

  const successfullyApplied = new Set<string>();
  for (const record of records) {
    if (record.rolled_back_at) continue;
    if (!record.finished_at) {
      throw new Error(
        "Database has an incomplete Prisma migration; refusing to seed.",
      );
    }
    if (!expected.has(record.migration_name)) {
      throw new Error(
        "Database has migrations absent from this release; refusing to seed.",
      );
    }
    successfullyApplied.add(record.migration_name);
  }

  if (
    successfullyApplied.size !== expected.size ||
    [...expected].some((migration) => !successfullyApplied.has(migration))
  ) {
    throw new Error("Database migrations are not current; refusing to seed.");
  }
}

export function assertSeedSchemaCompatible(
  expectedColumns: Readonly<Record<string, string>>,
  actualColumns: readonly SeedColumnRecord[],
  actualConstraints: readonly { conname: string }[],
): void {
  const actualColumnTypes = new Map(
    actualColumns.map((column) => [
      `${column.table_name}.${column.column_name}`,
      `${column.udt_name}:${column.numeric_precision ?? ""}:${column.numeric_scale ?? ""}`,
    ]),
  );
  for (const [column, expectedType] of Object.entries(expectedColumns)) {
    if (actualColumnTypes.get(column) !== expectedType) {
      throw new Error(
        "Database schema is missing or has incompatible Prisma columns; refusing to seed.",
      );
    }
  }

  const actualConstraintSet = new Set(
    actualConstraints.map(({ conname }) => conname),
  );
  for (const constraint of [
    "employees_current_salary_positive",
    "salary_revisions_new_salary_positive",
    "salary_revisions_previous_salary_positive",
    "salary_revisions_employee_id_fkey",
    "users_email_key",
    "employees_employee_number_key",
    "employees_email_key",
  ]) {
    if (!actualConstraintSet.has(constraint)) {
      throw new Error(
        "Database schema is missing required constraints; refusing to seed.",
      );
    }
  }
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

export function assertNeonSeedDatabaseEmpty(
  existingEmployees: readonly ExistingEmployee[],
  existingRevisions: readonly ExistingSalaryRevision[],
): void {
  if (existingEmployees.length || existingRevisions.length) {
    throw new Error(
      "Neon one-time seed requires empty employee and salary history tables; refusing to write.",
    );
  }
}
