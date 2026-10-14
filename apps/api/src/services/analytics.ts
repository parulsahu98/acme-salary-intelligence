import { prisma } from "../db.js";
import { salaryDistribution } from "../domain/salary.js";

export async function getAnalytics() {
  const [employees, byDepartment, byCountry, summary, salaryRows] =
    await Promise.all([
      prisma.employee.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.employee.groupBy({
        by: ["department", "currency"],
        _count: { _all: true },
        _avg: { currentSalary: true },
      }),
      prisma.employee.groupBy({
        by: ["country", "currency"],
        _count: { _all: true },
        _avg: { currentSalary: true },
      }),
      prisma.employee.groupBy({
        by: ["currency"],
        _count: { _all: true },
        _avg: { currentSalary: true },
        _min: { currentSalary: true },
        _max: { currentSalary: true },
      }),
      prisma.employee.findMany({
        select: { currency: true, currentSalary: true },
      }),
    ]);
  const salariesByCurrency = new Map<string, string[]>();
  for (const row of salaryRows) {
    const values = salariesByCurrency.get(row.currency) ?? [];
    values.push(row.currentSalary.toString());
    salariesByCurrency.set(row.currency, values);
  }
  const salarySummary = summary.map((row) => {
    const values = salariesByCurrency.get(row.currency) ?? [];
    const distribution = salaryDistribution(values, row.currency);
    return {
      currency: row.currency,
      employeeCount: row._count._all,
      average: row._avg.currentSalary?.toString() ?? null,
      minimum: row._min.currentSalary?.toString() ?? null,
      maximum: row._max.currentSalary?.toString() ?? null,
      median: distribution.median,
      salaryBands: distribution.bands,
    };
  });
  return {
    totalEmployees: employees.reduce((sum, row) => sum + row._count._all, 0),
    activeEmployees:
      employees.find((row) => row.status === "ACTIVE")?._count._all ?? 0,
    inactiveEmployees:
      employees.find((row) => row.status === "INACTIVE")?._count._all ?? 0,
    byDepartment: byDepartment.map((row) => ({
      department: row.department,
      currency: row.currency,
      employeeCount: row._count._all,
      averageSalary: row._avg.currentSalary?.toString() ?? null,
    })),
    byCountry: byCountry.map((row) => ({
      country: row.country,
      currency: row.currency,
      employeeCount: row._count._all,
      averageSalary: row._avg.currentSalary?.toString() ?? null,
    })),
    salarySummary,
  };
}
