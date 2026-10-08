import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

export const limiter = (perMinute: number) =>
  rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' },
  });

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function bearer(req: Request): string | null {
  const h = req.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Admin routes are disabled unless a strong ADMIN_TOKEN (>= 24 chars) is configured. */
export function requireAdmin(adminToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (adminToken.length < 24) {
      res.status(503).json({ error: 'admin_disabled', message: 'Admin access is not configured on this server.' });
      return;
    }
    const token = bearer(req);
    if (!token || !safeEqual(token, adminToken)) {
      res.status(401).json({ error: 'unauthorised' });
      return;
    }
    next();
  };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newVolunteerToken = () => randomBytes(32).toString('base64url');
export const volunteerToken = bearer;
