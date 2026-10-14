import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertSeedConfiguration,
  assertSeedDatabaseSafe,
  type ExistingEmployee,
  type ExistingSalaryRevision,
  type SyntheticEmployee,
} from "./seed-safety.js";

const databaseUrl = assertSeedConfiguration(process.env);
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const departments = [
  "Engineering",
  "Product",
  "People",
  "Finance",
  "Sales",
  "Operations",
  "Design",
  "Legal",
];
const jobs = [
  "Analyst",
  "Associate",
  "Manager",
  "Senior Specialist",
  "Director",
  "Engineer",
  "Consultant",
];
const regions = [
  { country: "United States", currency: "USD" },
  { country: "India", currency: "INR" },
  { country: "United Kingdom", currency: "GBP" },
  { country: "Germany", currency: "EUR" },
  { country: "Canada", currency: "CAD" },
  { country: "Australia", currency: "AUD" },
  { country: "Singapore", currency: "SGD" },
  { country: "Japan", currency: "JPY" },
  { country: "Bahrain", currency: "BHD" },
] as const;

function deterministicSalary(index: number, currency: string): string {
  const base = 35000 + ((index * 7919) % 115000);
  if (currency === "JPY") return String(base * 100);
  if (currency === "BHD")
    return `${Math.floor(base / 1000)}.${String((index * 137) % 1000).padStart(3, "0")}`;
  return `${base}.${String((index * 37) % 100).padStart(2, "0")}`;
}

function nameFor(index: number): string {
  const names = [
    "Alex Morgan",
    "Sam Taylor",
    "Jordan Lee",
    "Casey Patel",
    "Riley Chen",
    "Avery Singh",
    "Morgan Diaz",
    "Jamie Kim",
  ];
  return `${names[index % names.length]} ${String(index).padStart(5, "0")}`;
}

const employees: SyntheticEmployee[] = Array.from(
  { length: 10_000 },
  (_, zeroBasedIndex) => {
    const index = zeroBasedIndex + 1;
    const region = regions[(index * 7) % regions.length]!;
    return {
      id: `synthetic-employee-${String(index).padStart(5, "0")}`,
      employeeNumber: `ACME-${String(index).padStart(5, "0")}`,
      fullName: nameFor(index),
      email: `employee-${String(index).padStart(5, "0")}@example.test`,
      department: departments[(index * 3) % departments.length]!,
      jobTitle: jobs[(index * 5) % jobs.length]!,
      country: region.country,
      currency: region.currency,
      status: index % 11 === 0 ? "INACTIVE" : "ACTIVE",
      currentSalary: deterministicSalary(index, region.currency),
    };
  },
);

async function verifyExistingDataset(
  client: Pick<
    Prisma.TransactionClient,
    "employee" | "salaryRevision" | "user"
  >,
): Promise<boolean> {
  const [existingEmployees, existingRevisions, userCount] = await Promise.all([
    client.employee.findMany({
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        email: true,
        department: true,
        jobTitle: true,
        country: true,
        currency: true,
        status: true,
        currentSalary: true,
      },
    }),
    client.salaryRevision.findMany({
      select: {
        id: true,
        employeeId: true,
        previousSalary: true,
        newSalary: true,
        currency: true,
        reason: true,
      },
    }),
    client.user.count(),
  ]);
  return assertSeedDatabaseSafe(
    employees,
    existingEmployees.map((employee): ExistingEmployee => ({
      ...employee,
      currentSalary: employee.currentSalary.toString(),
    })),
    existingRevisions.map((revision): ExistingSalaryRevision => ({
      ...revision,
      previousSalary: revision.previousSalary?.toString() ?? null,
      newSalary: revision.newSalary.toString(),
    })),
    userCount,
  );
}

try {
  await prisma.$transaction(
    async (tx) => {
      const shouldInsert = await verifyExistingDataset(tx);
      if (shouldInsert) {
        for (let offset = 0; offset < employees.length; offset += 500) {
          const batch = employees.slice(offset, offset + 500);
          await tx.employee.createMany({ data: batch });
          await tx.salaryRevision.createMany({
            data: batch.map((employee) => ({
              id: `synthetic-revision-${employee.employeeNumber}`,
              employeeId: employee.id,
              previousSalary: null,
              newSalary: employee.currentSalary,
              currency: employee.currency,
              reason: "Initial synthetic record",
            })),
          });
        }
      }
      if (await verifyExistingDataset(tx)) {
        throw new Error(
          "Synthetic seed verification failed: target still appears empty.",
        );
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 120_000,
    },
  );
  console.info(
    `Verified ${employees.length} synthetic employees (dataset v1).`,
  );
} finally {
  await prisma.$disconnect();
}
