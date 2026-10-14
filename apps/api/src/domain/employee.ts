import { z } from "zod";
import { isValidSalary } from "./salary.js";

export const currencySchema = z.enum([
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CAD",
  "AUD",
  "SGD",
  "JPY",
  "BHD",
]);
export const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const salarySchema = z.string().max(20);

export const createEmployeeSchema = z
  .object({
    employeeNumber: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9-]+$/),
    fullName: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(254),
    department: z.string().trim().min(2).max(100),
    jobTitle: z.string().trim().min(2).max(120),
    country: z.string().trim().min(2).max(80),
    currency: currencySchema,
    status: statusSchema.default("ACTIVE"),
    currentSalary: salarySchema,
  })
  .superRefine((data, ctx) => {
    if (!isValidSalary(data.currentSalary, data.currency)) {
      ctx.addIssue({
        code: "custom",
        path: ["currentSalary"],
        message: `Salary must be positive and use no more than the ${data.currency} minor-unit precision.`,
      });
    }
  });

export const updateEmployeeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160).optional(),
    email: z.string().trim().email().max(254).optional(),
    department: z.string().trim().min(2).max(100).optional(),
    jobTitle: z.string().trim().min(2).max(120).optional(),
    country: z.string().trim().min(2).max(80).optional(),
    status: statusSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one editable field is required.",
  );

export const salaryUpdateSchema = z.object({
  newSalary: salarySchema,
  currency: currencySchema,
  effectiveAt: z.string().datetime({ offset: true }).optional(),
  reason: z.string().trim().max(500).optional(),
});
