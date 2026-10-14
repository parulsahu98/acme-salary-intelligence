import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../src/db.js";

const credentials = z
  .object({
    HR_EMAIL: z.string().email().max(254),
    HR_PASSWORD: z
      .string()
      .min(12)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
        message: "HR_PASSWORD must be no more than 72 UTF-8 bytes for bcrypt.",
      }),
  })
  .parse(process.env);

try {
  const email = credentials.HR_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(credentials.HR_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
  console.info("HR account provisioned.");
} finally {
  await prisma.$disconnect();
}
