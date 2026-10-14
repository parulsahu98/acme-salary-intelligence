import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??=
  "postgresql://salary_app:local_password@localhost:5432/acme_salary?schema=public";
process.env.JWT_SECRET ??=
  "test-secret-that-is-at-least-thirty-two-characters-long";
process.env.NODE_ENV = "test";
const { app } = await import("../src/app.js");

describe("API authentication boundary", () => {
  it("rejects unauthenticated employee access without querying employee data", async () => {
    const response = await request(app).get("/api/employees");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects malformed sign-in input before database access", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
