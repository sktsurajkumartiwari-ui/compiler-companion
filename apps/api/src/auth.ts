import { createHmac, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import "./config.js";

const scrypt = promisify(scryptCallback);
const secret = process.env.AUTH_SECRET;
if (!secret || secret === "replace-with-a-long-random-secret")
  console.warn("AUTH_SECRET is not configured; development-only signing key is in use.");
const signingKey = secret || "local-development-secret-change-before-deployment";

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}
export interface AuthRequest extends Request {
  userId?: string;
}

interface ResetCodeRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const resetCodes = new Map<string, ResetCodeRecord>();

export function generateResetCode(email: string): string {
  const normalized = email.trim().toLowerCase();
  const code = randomInt(100000, 999999).toString();
  resetCodes.set(normalized, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });
  return code;
}

export function verifyResetCode(email: string, code: string): { valid: boolean; error?: string } {
  const normalized = email.trim().toLowerCase();
  const record = resetCodes.get(normalized);
  if (!record) {
    return { valid: false, error: "No verification code requested or it expired. Please request a new one." };
  }
  if (Date.now() > record.expiresAt) {
    resetCodes.delete(normalized);
    return { valid: false, error: "Verification code has expired. Please request a new one." };
  }
  if (record.attempts >= 5) {
    resetCodes.delete(normalized);
    return { valid: false, error: "Too many failed attempts. Please request a new verification code." };
  }
  if (record.code !== code.trim()) {
    record.attempts++;
    const remaining = 5 - record.attempts;
    return {
      valid: false,
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
  }
  return { valid: true };
}

export function clearResetCode(email: string) {
  resetCodes.delete(email.trim().toLowerCase());
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(expected, "hex"), derived);
}
export function issueToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }),
  ).toString("base64url");
  const signature = createHmac("sha256", signingKey).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function requireUser(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in is required." });
  const [payload, signature] = token.split(".");
  const expected = createHmac("sha256", signingKey)
    .update(payload ?? "")
    .digest("base64url");
  if (
    !payload ||
    !signature ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return res.status(401).json({ error: "Invalid session." });
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub: string;
      exp: number;
    };
    if (!claims.sub || claims.exp < Date.now()) throw new Error();
    req.userId = claims.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired." });
  }
}
