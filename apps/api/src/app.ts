import { EmploymentStatus, Prisma } from "@prisma/client";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { corsOrigins } from "./config.js";
import { prisma } from "./db.js";
import {
  createEmployeeSchema,
  salaryUpdateSchema,
  updateEmployeeSchema,
} from "./domain/employee.js";
import { isValidSalary } from "./domain/salary.js";
import { requireAuth } from "./middleware/auth.js";
import { authenticate } from "./services/auth.js";
import { getAnalytics } from "./services/analytics.js";
import {
  createEmployee,
  employeeSortFields,
  listEmployees,
  updateSalary,
} from "./services/employee.js";

const app = express();
const api = express.Router();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      return callback(
        Object.assign(new Error("Origin is not allowed by CORS."), {
          status: 403,
        }),
      );
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "32kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many sign-in attempts. Try again later.",
    },
  },
});

api.get("/health", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

api.post("/auth/login", loginLimiter, async (req, res) => {
  const parsed = z
    .object({
      email: z.string().trim().email().max(254),
      password: z
        .string()
        .min(1)
        .max(72)
        .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Enter a valid email and password.",
      },
    });
    return;
  }
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result) {
    res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      },
    });
    return;
  }
  res.json(result);
});

api.get("/auth/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true },
  });
  if (!user) {
    res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Sign-in is required." },
    });
    return;
  }
  res.json({ user });
});

api.use(requireAuth);

api.get("/employees", async (req, res) => {
  const querySchema = z
    .object({
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      search: z.string().trim().max(100).optional(),
      department: z.string().trim().max(100).optional(),
      country: z.string().trim().max(80).optional(),
      status: z.nativeEnum(EmploymentStatus).optional(),
      sortBy: z.enum(employeeSortFields).default("employeeNumber"),
      sortOrder: z.enum(["asc", "desc"]).default("asc"),
    })
    .strict();
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid employee listing options.",
      },
    });
    return;
  }
  res.json(await listEmployees(parsed.data));
});

api.post("/employees", async (req, res) => {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid employee details.",
      },
    });
    return;
  }
  res.status(201).json({ employee: await createEmployee(parsed.data) });
});

api.get("/employees/:id", async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: { salaryHistory: { orderBy: { effectiveAt: "desc" } } },
  });
  if (!employee) {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Employee not found." } });
    return;
  }
  res.json({ employee });
});

api.patch("/employees/:id", async (req, res) => {
  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid employee details.",
      },
    });
    return;
  }
  const employee = await prisma.employee.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      ...(parsed.data.email ? { email: parsed.data.email.toLowerCase() } : {}),
    },
  });
  res.json({ employee });
});

api.post("/employees/:id/salary-revisions", async (req, res) => {
  const parsed = salaryUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid salary details.",
      },
    });
    return;
  }
  if (!isValidSalary(parsed.data.newSalary, parsed.data.currency)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Salary must be positive and use no more than the ${parsed.data.currency} minor-unit precision.`,
      },
    });
    return;
  }
  const result = await updateSalary(req.params.id, parsed.data);
  if (!result) {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Employee not found." } });
    return;
  }
  res.json(result);
});

api.get("/analytics", async (_req, res) => {
  res.json(await getAnalytics());
});

app.use("/api", api);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
      },
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message:
            "An employee or user with these unique details already exists.",
        },
      });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Requested record was not found.",
        },
      });
      return;
    }
  }
  if (error instanceof Error && "status" in error && error.status === 400) {
    res.status(400).json({
      error: { code: "INVALID_SALARY_CURRENCY", message: error.message },
    });
    return;
  }
  if (error instanceof Error && "status" in error && error.status === 403) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN_ORIGIN",
        message: "This request origin is not allowed.",
      },
    });
    return;
  }
  if (error instanceof Error && "status" in error && error.status === 413) {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body is too large.",
      },
    });
    return;
  }
  console.error(
    "Unhandled API error.",
    error instanceof Error ? error.name : "UnknownError",
  );
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
};

app.use(errorHandler);

export { app };
