import { Currency, EmploymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import type { SupportedCurrency } from "../domain/salary.js";

export const employeeSortFields = [
  "employeeNumber",
  "fullName",
  "department",
  "country",
  "status",
  "updatedAt",
] as const;
export type EmployeeSortField = (typeof employeeSortFields)[number];

export async function listEmployees(query: {
  page: number;
  pageSize: number;
  search?: string;
  department?: string;
  country?: string;
  status?: EmploymentStatus;
  sortBy: EmployeeSortField;
  sortOrder: "asc" | "desc";
}) {
  const where: Prisma.EmployeeWhereInput = {
    ...(query.search
      ? {
          OR: [
            { employeeNumber: { contains: query.search, mode: "insensitive" } },
            { fullName: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.department ? { department: query.department } : {}),
    ...(query.country ? { country: query.country } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
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
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.employee.count({ where }),
  ]);
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function createEmployee(data: {
  employeeNumber: string;
  fullName: string;
  email: string;
  department: string;
  jobTitle: string;
  country: string;
  currency: SupportedCurrency;
  status: EmploymentStatus;
  currentSalary: string;
}) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        ...data,
        employeeNumber: data.employeeNumber.toUpperCase(),
        email: data.email.toLowerCase(),
        currency: data.currency as Currency,
      },
    });
    await tx.salaryRevision.create({
      data: {
        employeeId: employee.id,
        previousSalary: null,
        newSalary: data.currentSalary,
        currency: data.currency,
      },
    });
    return employee;
  });
}

export async function updateSalary(
  employeeId: string,
  data: {
    newSalary: string;
    currency: SupportedCurrency;
    effectiveAt?: string;
    reason?: string;
  },
) {
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.employee.findUnique({
        where: { id: employeeId },
      });
      if (!current) return null;
      if (current.currency !== data.currency) {
        throw Object.assign(
          new Error(
            "Salary currency must match the employee's configured currency.",
          ),
          { status: 400 },
        );
      }
      if (current.currentSalary.equals(data.newSalary)) {
        throw Object.assign(
          new Error(
            "The new salary must be different from the current salary.",
          ),
          { status: 400 },
        );
      }
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { currentSalary: data.newSalary },
      });
      const revision = await tx.salaryRevision.create({
        data: {
          employeeId,
          previousSalary: current.currentSalary,
          newSalary: data.newSalary,
          currency: data.currency,
          ...(data.effectiveAt
            ? { effectiveAt: new Date(data.effectiveAt) }
            : {}),
          ...(data.reason ? { reason: data.reason } : {}),
        },
      });
      return { employee: updated, revision };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
