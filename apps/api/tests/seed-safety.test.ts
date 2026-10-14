import { describe, expect, it } from "vitest";
import {
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
    ).toThrow(/development or NODE_ENV=test/);
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
    ).toThrow(/localhost/);
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
    expect(assertSeedConfiguration(baseEnvironment)).toBe(allowedUrl);
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
});
