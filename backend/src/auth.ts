// src/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, SignOptions, Secret } from 'jsonwebtoken';
import { User, type UserDoc } from './model';

export type Role = 'employee' | 'manager' | 'admin';
export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  managerId: number | null;
};

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'devsecret';
const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

export function signToken(userId: number): string {
  // put the numeric id in sub as a string for compatibility
  const payload = { sub: String(userId) };
  const options: SignOptions = { expiresIn: WEEK_IN_SECONDS }; // numeric avoids TS complaints
  return jwt.sign(payload, JWT_SECRET, options);
}

export interface AuthedRequest extends Request {
  user?: PublicUser;
}

function toPublic(u: UserDoc): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    managerId: u.managerId,
  };
}

function parseUserIdFromToken(token: string): number | null {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (typeof decoded === 'string') return null;

  const sub = decoded.sub;
  if (typeof sub === 'number') return sub;
  if (typeof sub === 'string') {
    const n = Number.parseInt(sub, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export async function ensureAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = hdr.slice('Bearer '.length);
  const userId = parseUserIdFromToken(token);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const u = await User.findOne({ id: userId });
  if (!u) return res.status(401).json({ error: 'Unauthorized' });

  req.user = toPublic(u);
  return next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// quick helper for manager/admin protected routes
export const ensureManagerOrAdmin = requireRole('manager', 'admin');
