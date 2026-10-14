import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Sign-in is required." },
    });
    return;
  }
  try {
    const payload = jwt.verify(authorization.slice(7), config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "acme-salary-intelligence",
    });
    if (typeof payload === "string" || typeof payload.sub !== "string")
      throw new Error("Invalid token subject");
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Sign-in is required." },
    });
  }
}
