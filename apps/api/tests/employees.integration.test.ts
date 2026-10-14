import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error(
    "Integration tests require DATABASE_URL to point to a dedicated database whose name ends in _test.",
  );
}
process.env.JWT_SECRET ??=
  "integration-only-secret-with-at-least-thirty-two-characters";
process.env.NODE_ENV = "test";

const [{ app }, { prisma }] = await Promise.all([
  import("../src/app.js"),
  import("../src/db.js"),
]);
const email = "integration-hr@example.test";
const password = "integration-test-only-password";
const employeeNumber = `IT-${process.pid}-${Date.now()}`;
let token = "";

describe("employee and salary API integration", () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash: await bcrypt.hash(password, 4) },
      update: { passwordHash: await bcrypt.hash(password, 4) },
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    expect(login.status).toBe(200);
    token = login.body.token as string;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DROP TRIGGER IF EXISTS integration_reject_revision ON salary_revisions`;
    await prisma.$executeRaw`DROP FUNCTION IF EXISTS integration_reject_revision()`;
    const employee = await prisma.employee.findUnique({
      where: { employeeNumber },
    });
    if (employee) {
      await prisma.salaryRevision.deleteMany({
        where: { employeeId: employee.id },
      });
      await prisma.employee.delete({ where: { id: employee.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("validates protected CRUD, pagination, duplicate IDs, transactional history, and analytics", async () => {
    const payload = {
      employeeNumber,
      fullName: "Synthetic Integration User",
      email: `${employeeNumber.toLowerCase()}@example.test`,
      department: "Engineering",
      jobTitle: "Test Engineer",
      country: "United States",
      currency: "USD",
      currentSalary: "5100.25",
    };

    expect((await request(app).get("/api/health")).status).toBe(200);
    expect((await request(app).get("/api/employees")).status).toBe(401);

    const created = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);
    expect(created.status).toBe(201);
    const employeeId = created.body.employee.id as string;

    const duplicate = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...payload,
        employeeNumber: payload.employeeNumber.toLowerCase(),
        email: `duplicate-${payload.email}`,
      });
    expect(duplicate.status).toBe(409);

    const listed = await request(app)
      .get("/api/employees?page=1&pageSize=1&search=IT-")
      .set("Authorization", `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.pageSize).toBe(1);
    expect(listed.body.items).toHaveLength(1);

    const edited = await request(app)
      .patch(`/api/employees/${employeeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "INACTIVE", department: "Product" });
    expect(edited.status).toBe(200);
    expect(edited.body.employee.department).toBe("Product");

    const invalidMassAssignment = await request(app)
      .patch(`/api/employees/${employeeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ currentSalary: "1.00" });
    expect(invalidMassAssignment.status).toBe(400);

    const updated = await request(app)
      .post(`/api/employees/${employeeId}/salary-revisions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        newSalary: "5200.75",
        currency: "USD",
        reason: "Integration salary revision",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.employee.currentSalary).toBe("5200.75");
    expect(updated.body.revision.previousSalary).toBe("5100.25");

    await prisma.$executeRaw`DROP TRIGGER IF EXISTS integration_reject_revision ON salary_revisions`;
    await prisma.$executeRaw`DROP FUNCTION IF EXISTS integration_reject_revision()`;
    await prisma.$executeRaw`
      CREATE FUNCTION integration_reject_revision()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.reason = 'ROLLBACK TEST' THEN
          RAISE EXCEPTION 'forced integration failure';
        END IF;
        RETURN NEW;
      END;
      $function$
    `;
    await prisma.$executeRaw`
      CREATE TRIGGER integration_reject_revision
      BEFORE INSERT ON salary_revisions
      FOR EACH ROW
      EXECUTE FUNCTION integration_reject_revision()
    `;
    const rolledBack = await request(app)
      .post(`/api/employees/${employeeId}/salary-revisions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        newSalary: "5300.75",
        currency: "USD",
        reason: "ROLLBACK TEST",
      });
    expect(rolledBack.status).toBe(500);

    const mismatch = await request(app)
      .post(`/api/employees/${employeeId}/salary-revisions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ newSalary: "6000.00", currency: "EUR" });
    expect(mismatch.status).toBe(400);

    const persisted = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salaryHistory: { orderBy: { effectiveAt: "desc" } } },
    });
    expect(persisted?.currentSalary.toString()).toBe("5200.75");
    expect(persisted?.salaryHistory).toHaveLength(2);
    expect(persisted?.salaryHistory[0]?.reason).toBe(
      "Integration salary revision",
    );

    const analytics = await request(app)
      .get("/api/analytics")
      .set("Authorization", `Bearer ${token}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.totalEmployees).toBeGreaterThan(0);
    expect(
      analytics.body.salarySummary.some(
        (row: { currency: string }) => row.currency === "USD",
      ),
    ).toBe(true);
    expect(
      analytics.body.byCountry.some(
        (row: { country: string; currency: string; averageSalary: string }) =>
          row.country === "United States" &&
          row.currency === "USD" &&
          row.averageSalary !== null,
      ),
    ).toBe(true);
  });
});
