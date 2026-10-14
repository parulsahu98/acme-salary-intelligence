import { describe, expect, it } from "vitest";
import {
  assertNeonSeedDatabaseEmpty,
  assertSeedMigrationsCurrent,
  assertSeedSchemaCompatible,
  assertSeedConfiguration,
  assertSeedDatabaseSafe,
  type ExistingEmployee,
  type ExistingSalaryRevision,
  type SyntheticEmployee,
} from "../prisma/seed-safety.js";

const allowedUrl =
  "postgresql://local-user@localhost:5432/acme_salary_test?schema=public";
const baseEnvironment = {
  NODE_ENV: "test",
  SEED_SYNTHETIC_DATA: "YES",
  DATABASE_URL: allowedUrl,
  SEED_ALLOWED_DATABASE_URL: allowedUrl,
};

const expectedEmployees: SyntheticEmployee[] = [
  {
    id: "synthetic-employee-00001",
    employeeNumber: "ACME-00001",
    fullName: "Sam Taylor 00001",
    email: "employee-00001@example.test",
    department: "Finance",
    jobTitle: "Engineer",
    country: "Japan",
    currency: "JPY",
    status: "ACTIVE",
    currentSalary: "4291900",
  },
];

const existingEmployees: ExistingEmployee[] = expectedEmployees.map((row) => ({
  ...row,
}));

const existingRevisions: ExistingSalaryRevision[] = [
  {
    id: "synthetic-revision-ACME-00001",
    employeeId: "synthetic-employee-00001",
    previousSalary: null,
    newSalary: "4291900.0000",
    currency: "JPY",
    reason: "Initial synthetic record",
  },
];

describe("synthetic seed configuration safeguards", () => {
  it("rejects missing environment, opt-in, and allowlist configuration", () => {
    expect(() => assertSeedConfiguration({})).toThrow(/NODE_ENV/);
    expect(() =>
      assertSeedConfiguration({
        NODE_ENV: "test",
        SEED_SYNTHETIC_DATA: "YES",
        SEED_ALLOWED_DATABASE_URL: allowedUrl,
      }),
    ).toThrow(/DATABASE_URL is required/);
    expect(() =>
      assertSeedConfiguration({
        ...baseEnvironment,
        SEED_SYNTHETIC_DATA: undefined,
      }),
    ).toThrow(/explicitly opt in/);
    expect(() =>
      assertSeedConfiguration({
        ...baseEnvironment,
        SEED_ALLOWED_DATABASE_URL: undefined,
      }),
    ).toThrow(/must explicitly allow/);
  });

  it("rejects production and non-allowlisted or remote database targets", () => {
    expect(() =>
      assertSeedConfiguration({ ...baseEnvironment, NODE_ENV: "production" }),
    ).toThrow(/SEED_NEON_ONCE/);
    expect(() =>
      assertSeedConfiguration({
        ...baseEnvironment,
        DATABASE_URL: "postgresql://user@localhost:5432/acme_salary",
      }),
    ).toThrow(/does not exactly match/);
    const remoteUrl =
      "postgresql://user@db.example.com:5432/acme_salary?schema=public";
    expect(() =>
      assertSeedConfiguration({
        ...baseEnvironment,
        DATABASE_URL: remoteUrl,
        SEED_ALLOWED_DATABASE_URL: remoteUrl,
      }),
    ).toThrow(/localhost PostgreSQL targets/);
    const unapprovedName =
      "postgresql://user@localhost:5432/other_database?schema=public";
    expect(() =>
      assertSeedConfiguration({
        ...baseEnvironment,
        DATABASE_URL: unapprovedName,
        SEED_ALLOWED_DATABASE_URL: unapprovedName,
      }),
    ).toThrow(/restricted to acme_salary/);
  });

  it("accepts only explicitly opted-in, allowlisted local test targets", () => {
    expect(assertSeedConfiguration(baseEnvironment)).toEqual({
      databaseUrl: allowedUrl,
      kind: "local",
    });
  });

  it("requires all explicit approvals for one Neon production endpoint", () => {
    const neonUrl =
      "postgresql://seed-user:secret@ep-approved-branch.ap-southeast-1.aws.neon.tech/acme_prod?sslmode=require";
    const neonEnvironment = {
      NODE_ENV: "production",
      SEED_SYNTHETIC_DATA: "YES",
      SEED_NEON_ONCE: "YES",
      DATABASE_URL: neonUrl,
      SEED_ALLOWED_DATABASE_URL: neonUrl,
      SEED_ALLOWED_NEON_HOST: "ep-approved-branch.ap-southeast-1.aws.neon.tech",
      SEED_ALLOWED_NEON_DATABASE: "acme_prod",
    };
    expect(assertSeedConfiguration(neonEnvironment)).toEqual({
      databaseUrl: neonUrl,
      kind: "neon",
    });
    expect(() =>
      assertSeedConfiguration({
        ...neonEnvironment,
        SEED_ALLOWED_NEON_HOST:
          "ep-another-branch.ap-southeast-1.aws.neon.tech",
      }),
    ).toThrow(/approved Neon endpoint/);
    expect(() =>
      assertSeedConfiguration({
        ...neonEnvironment,
        SEED_ALLOWED_NEON_DATABASE: "another_database",
      }),
    ).toThrow(/approved Neon database/);
    expect(() =>
      assertSeedConfiguration({
        ...neonEnvironment,
        SEED_NEON_ONCE: undefined,
      }),
    ).toThrow(/SEED_NEON_ONCE/);
    expect(() =>
      assertSeedConfiguration({
        ...neonEnvironment,
        DATABASE_URL: "postgresql://user@db.example.com/acme_prod",
        SEED_ALLOWED_DATABASE_URL: "postgresql://user@db.example.com/acme_prod",
        SEED_ALLOWED_NEON_HOST: "db.example.com",
      }),
    ).toThrow(/approved Neon endpoint/);
  });
});

describe("synthetic seed database safeguards", () => {
  it("permits an empty target and an exact complete synthetic dataset", () => {
    expect(assertSeedDatabaseSafe(expectedEmployees, [], [], 0)).toBe(true);
    expect(
      assertSeedDatabaseSafe(
        expectedEmployees,
        existingEmployees,
        existingRevisions,
        0,
      ),
    ).toBe(false);
  });

  it("rejects user data, partial data, and any non-synthetic row", () => {
    expect(() => assertSeedDatabaseSafe(expectedEmployees, [], [], 1)).toThrow(
      /user accounts/,
    );
    expect(() =>
      assertSeedDatabaseSafe(expectedEmployees, existingEmployees, [], 0),
    ).toThrow(/neither empty nor the complete/);
    expect(() =>
      assertSeedDatabaseSafe(
        expectedEmployees,
        [{ ...existingEmployees[0]!, fullName: "Real Employee" }],
        existingRevisions,
        0,
      ),
    ).toThrow(/employee data outside/);
    expect(() =>
      assertSeedDatabaseSafe(
        expectedEmployees,
        existingEmployees,
        [{ ...existingRevisions[0]!, reason: "Salary change" }],
        0,
      ),
    ).toThrow(/salary history outside/);
  });

  it("requires empty employee and salary history tables for Neon seeding", () => {
    expect(() => assertNeonSeedDatabaseEmpty([], [])).not.toThrow();
    expect(() => assertNeonSeedDatabaseEmpty(existingEmployees, [])).toThrow(
      /requires empty employee and salary history/,
    );
    expect(() => assertNeonSeedDatabaseEmpty([], existingRevisions)).toThrow(
      /requires empty employee and salary history/,
    );
  });
});

describe("Prisma migration and schema checks", () => {
  const migrations = [
    "20261014120000_initial",
    "20261014173000_previous_salary_constraint",
  ];

  it("requires every checked-in migration to be applied successfully", () => {
    assertSeedMigrationsCurrent(
      migrations,
      migrations.map((migration_name) => ({
        migration_name,
        finished_at: new Date(),
        rolled_back_at: null,
      })),
    );
    expect(() => assertSeedMigrationsCurrent(migrations, [])).toThrow(
      /not current/,
    );
    expect(() =>
      assertSeedMigrationsCurrent(migrations, [
        {
          migration_name: migrations[0]!,
          finished_at: null,
          rolled_back_at: null,
        },
      ]),
    ).toThrow(/incomplete Prisma migration/);
  });

  it("requires expected columns and relational/integrity constraints", () => {
    const expectedColumns = {
      "users.id": "text::",
      "users.email": "varchar::",
      "users.password_hash": "varchar::",
      "employees.id": "text::",
      "employees.employee_number": "varchar::",
      "employees.current_salary": "numeric:19:4",
      "salary_revisions.id": "text::",
      "salary_revisions.employee_id": "text::",
      "salary_revisions.new_salary": "numeric:19:4",
    };
    const actualColumns = [
      ["users", "id", "text", null, null],
      ["users", "email", "varchar", null, null],
      ["users", "password_hash", "varchar", null, null],
      ["employees", "id", "text", null, null],
      ["employees", "employee_number", "varchar", null, null],
      ["employees", "current_salary", "numeric", 19, 4],
      ["salary_revisions", "id", "text", null, null],
      ["salary_revisions", "employee_id", "text", null, null],
      ["salary_revisions", "new_salary", "numeric", 19, 4],
    ].map(
      ([
        table_name,
        column_name,
        udt_name,
        numeric_precision,
        numeric_scale,
      ]) => ({
        table_name: String(table_name),
        column_name: String(column_name),
        udt_name: String(udt_name),
        numeric_precision:
          numeric_precision === null ? null : Number(numeric_precision),
        numeric_scale: numeric_scale === null ? null : Number(numeric_scale),
      }),
    );
    const actualConstraints = [
      "employees_current_salary_positive",
      "salary_revisions_new_salary_positive",
      "salary_revisions_previous_salary_positive",
      "salary_revisions_employee_id_fkey",
      "users_email_key",
      "employees_employee_number_key",
      "employees_email_key",
    ].map((conname) => ({ conname }));
    expect(() =>
      assertSeedSchemaCompatible(
        expectedColumns,
        actualColumns.map((column) =>
          column.column_name === "current_salary"
            ? { ...column, numeric_scale: 2 }
            : column,
        ),
        actualConstraints,
      ),
    ).toThrow(/incompatible Prisma columns/);
    expect(() =>
      assertSeedSchemaCompatible(
        expectedColumns,
        actualColumns,
        actualConstraints,
      ),
    ).not.toThrow();
    expect(() =>
      assertSeedSchemaCompatible(expectedColumns, [], actualConstraints),
    ).toThrow(/missing or has incompatible Prisma columns/);
    expect(() =>
      assertSeedSchemaCompatible(expectedColumns, actualColumns, []),
    ).toThrow(/missing required constraints/);
  });
});
