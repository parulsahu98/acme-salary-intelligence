import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logUnexpectedApiError } from "../src/diagnostics.js";

afterEach(() => vi.restoreAllMocks());

describe("development API error diagnostics", () => {
  it("logs Prisma code, safe metadata, message, and stack with secrets redacted", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Column missing; password='test-password' params: ['private-value']",
      {
        code: "P2022",
        clientVersion: "6.12.0",
        meta: {
          modelName: "User",
          column: "users.password_hash",
          params: ["private-value"],
          database_url: "postgresql://private:secret@db.internal/acme",
        },
      },
    );
    error.stack = [
      `${error.name}: ${error.message}`,
      "    at authenticate (src/services/auth.ts:8:20)",
      "    at query SELECT * FROM users WHERE email = 'private-value'",
    ].join("\n");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    logUnexpectedApiError(error, "development");

    const [, details] = consoleError.mock.calls[0]!;
    expect(details).toMatchObject({
      class: "PrismaClientKnownRequestError",
      code: "P2022",
      meta: { modelName: "User", column: "users.password_hash" },
    });
    expect(details).not.toHaveProperty("meta.params");
    expect(details).not.toHaveProperty("meta.database_url");
    expect(details.message).toContain("password=[REDACTED]");
    expect(details.message).toContain("params=[REDACTED]");
    expect(details.stack).toContain("at authenticate");
    expect(JSON.stringify(details)).not.toContain("test-password");
    expect(JSON.stringify(details)).not.toContain("private-value");
    expect(JSON.stringify(details)).not.toContain("postgresql://");
  });

  it("logs only safe Prisma identifiers and metadata in production", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "password='sensitive message'",
      {
        code: "P2022",
        clientVersion: "6.12.0",
        meta: {
          modelName: "User",
          column: "users.password_hash",
          params: ["sensitive parameter"],
        },
      },
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    logUnexpectedApiError(error, "production");

    const [, details] = consoleError.mock.calls[0]!;
    expect(details).toEqual({
      class: "PrismaClientKnownRequestError",
      code: "P2022",
      meta: { modelName: "User", column: "users.password_hash" },
    });
    expect(JSON.stringify(details)).not.toContain("sensitive");
  });
});
