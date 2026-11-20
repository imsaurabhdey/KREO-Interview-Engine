/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise Server-Verified Session Authentication, RBAC & Organization Scoping Middleware.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { getDb } from './db';
import { UserAccount, UserRole } from './types';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgName: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

interface SessionPayload {
  sub: string;
  email: string;
  role: UserRole;
  orgName: string;
  iat: number;
  exp: number;
}

const SESSION_COOKIE_NAME = 'kreo_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SECRET_FILE_PATH = path.join(process.cwd(), '.session-secret');

let cachedSigningSecret: string | null = null;

function getSigningSecret(): string {
  if (cachedSigningSecret) return cachedSigningSecret;

  const envSecret = (process.env.SESSION_SECRET || '').trim();
  if (envSecret && envSecret.length >= 16) {
    cachedSigningSecret = envSecret;
    return cachedSigningSecret;
  }

  // Persist a local random secret across dev restarts (gitignored)
  try {
    if (fs.existsSync(SECRET_FILE_PATH)) {
      const stored = fs.readFileSync(SECRET_FILE_PATH, 'utf-8').trim();
      if (stored.length >= 32) {
        cachedSigningSecret = stored;
        return cachedSigningSecret;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE_PATH, generated, { encoding: 'utf-8', mode: 0o600 });
    cachedSigningSecret = generated;
    return cachedSigningSecret;
  } catch {
    cachedSigningSecret = crypto.randomBytes(32).toString('hex');
    return cachedSigningSecret;
  }
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  let padded = input.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function createSessionToken(user: Pick<UserAccount, 'id' | 'email' | 'role' | 'orgName'>): string {
  const now = Date.now();
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email.toLowerCase().trim(),
    role: user.role,
    orgName: user.orgName || 'Kreo Software',
    iat: now,
    exp: now + SESSION_TTL_MS
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest();
  const encodedSig = base64UrlEncode(sig);

  return `${encodedPayload}.${encodedSig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  try {
    const expectedSig = base64UrlEncode(
      crypto
        .createHmac('sha256', getSigningSecret())
        .update(encodedPayload)
        .digest()
    );

    const a = Buffer.from(encodedSig, 'utf-8');
    const b = Buffer.from(expectedSig, 'utf-8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload.sub || !payload.email || !payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    isSecure ? 'SameSite=None' : 'SameSite=Lax'
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    isSecure ? 'SameSite=None' : 'SameSite=Lax'
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }

  return null;
}

/**
 * Normalizes organization identifiers so distinct tenants are isolated,
 * while legacy Kreo default org names continue sharing default workspace records.
 */
export function normalizeOrgKey(orgName?: string): string {
  const cleaned = (orgName || '').trim().toLowerCase();
  if (
    !cleaned ||
    cleaned === 'kreo software' ||
    cleaned === 'kreo software labs' ||
    cleaned === 'kreo software enterprise' ||
    cleaned === 'kreo software authorized account'
  ) {
    return 'kreo-default';
  }
  return cleaned.replace(/\s+/g, ' ');
}

export function canAccessOrg(authUser: AuthenticatedUser, recordOrgName?: string): boolean {
  return normalizeOrgKey(authUser.orgName) === normalizeOrgKey(recordOrgName);
}

/**
 * Structured audit logger for sensitive reads, writes, and admin actions.
 */
export function logAuditEvent(
  action: string,
  actor: Pick<AuthenticatedUser, 'email' | 'role' | 'orgName'> | { email: string; role?: string; orgName?: string },
  details?: Record<string, unknown>
) {
  const entry = {
    ts: new Date().toISOString(),
    action,
    actorEmail: actor.email,
    actorRole: actor.role || 'Unknown',
    org: normalizeOrgKey(actor.orgName),
    ...(details ? { details } : {})
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

export function tryAuthenticateRequest(req: Request): AuthenticatedUser | null {
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const db = getDb();
  const account = (db.accounts || []).find(
    (acc) => acc.id === payload.sub && acc.email.toLowerCase().trim() === payload.email
  );
  if (!account) return null;

  return {
    id: account.id,
    name: account.name,
    email: account.email.toLowerCase().trim(),
    role: account.role,
    orgName: account.orgName || 'Kreo Software'
  };
}

/**
 * Express middleware: verifies server-signed session token AND confirms the account
 * still exists in the database with its live role/org.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session is invalid or expired. Please log in again.' });
  }

  const db = getDb();
  const account = (db.accounts || []).find(
    (acc) => acc.id === payload.sub && acc.email.toLowerCase().trim() === payload.email
  );

  if (!account) {
    return res.status(401).json({ error: 'Account no longer active. Please log in again.' });
  }

  req.authUser = {
    id: account.id,
    name: account.name,
    email: account.email.toLowerCase().trim(),
    role: account.role,
    orgName: account.orgName || 'Kreo Software'
  };

  next();
}

/**
 * Express middleware: restricts access to verified users holding one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      logAuditEvent('ACCESS_DENIED', req.authUser, {
        path: req.originalUrl,
        method: req.method,
        requiredRoles: allowedRoles
      });
      return res.status(403).json({
        error: `Access Denied: Requires ${allowedRoles.join(' or ')} authorization.`
      });
    }
    next();
  };
}
