import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../db.js";

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return null;
  return {
    token: jwt.sign({ sub: user.id }, config.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "1h",
      issuer: "acme-salary-intelligence",
    }),
    user: { id: user.id, email: user.email },
  };
}
