import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { accounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "lov-secret-key-2024";
const COOKIE_NAME = "lov_auth_token";

export interface AuthRequest extends Request {
  user?: any;
}

export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  
  if (!token) {
    return res.status(401).json({ error: "Unauthorized", message: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
  }

  const account = await storage.getAccount(decoded.id);
  if (!account) {
    return res.status(401).json({ error: "Unauthorized", message: "Account not found" });
  }

  // Combat-logout timer: check if player was in combat recently
  if (account.lastCombatTime) {
    const lastCombat = new Date(account.lastCombatTime).getTime();
    const now = Date.now();
    const COMBAT_LOGOUT_WAIT = 30 * 1000; // 30 seconds
    if (now - lastCombat < COMBAT_LOGOUT_WAIT) {
      return res.status(403).json({ 
        error: "In Combat", 
        message: `You must wait ${Math.ceil((COMBAT_LOGOUT_WAIT - (now - lastCombat)) / 1000)}s after combat to logout or switch sessions.` 
      });
    }
  }

  // Duplicate login protection: check if session matches
  if (account.currentSessionId && account.currentSessionId !== decoded.sessionId) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: "Session expired", message: "You have been logged in from another device" });
  }

  req.user = account;
  next();
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden", message: "Admin access required" });
  }
  next();
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

export { COOKIE_NAME };
