/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise Security Middleware: Restricted CORS, Security Headers,
 * Sliding-Window Rate Limiting, and Sensitive Data Redaction.
 */

import { Request, Response, NextFunction } from 'express';

const SENSITIVE_KEYS = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'passwordhash',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'resetcode',
  'apikey',
  'secret',
  'session_secret'
]);

/**
 * Recursively redacts sensitive fields before structured logging.
 */
export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 2000) return `${value.slice(0, 200)}...[truncated]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactSensitiveData(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitiveData(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/**
 * Standard HTTP security headers (iframe-compatible for AI Studio preview).
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=()');

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * Restricted CORS policy:
 * Allows same-host requests, configured ALLOWED_ORIGINS, APP_URL, and localhost dev origins.
 * Blocks unauthorized cross-origin API access with 403 instead of wildcard '*'.
 */
export function createCorsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (!origin) {
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      return next();
    }

    const configured = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const appUrlOrigin = (() => {
      try {
        return process.env.APP_URL ? new URL(process.env.APP_URL).origin : '';
      } catch {
        return '';
      }
    })();

    let originHost = '';
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return res.status(403).json({ error: 'CORS policy: Invalid Origin header.' });
    }

    const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim().toLowerCase();
    const isSameHost = Boolean(reqHost && originHost === reqHost);
    const isLocalDev =
      originHost.startsWith('localhost:') ||
      originHost === 'localhost' ||
      originHost.startsWith('127.0.0.1:') ||
      originHost === '127.0.0.1';

    const cleanOrigin = origin.replace(/\/+$/, '');
    const isExplicitlyAllowed =
      configured.includes(cleanOrigin) ||
      (Boolean(appUrlOrigin) && cleanOrigin === appUrlOrigin);

    const isAllowed =
      configured.length > 0
        ? (isExplicitlyAllowed || isSameHost)
        : (isSameHost || isLocalDev || isExplicitlyAllowed);

    if (!isAllowed) {
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'CORS policy: Origin not allowed.' });
      }
      return next();
    }

    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  };
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

/**
 * In-memory sliding-window rate limiter with automatic stale-entry cleanup.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix, keyGenerator, message } = options;
  const buckets = new Map<string, number[]>();

  // Periodic cleanup to keep memory bounded
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of buckets.entries()) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) {
        buckets.delete(key);
      } else {
        buckets.set(key, fresh);
      }
    }
  }, Math.max(windowMs, 60_000));
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const cutoff = now - windowMs;
    const rawKey = keyGenerator
      ? keyGenerator(req)
      : (req.ip || req.socket.remoteAddress || 'unknown');
    const bucketKey = `${keyPrefix}:${rawKey}`;

    const timestamps = (buckets.get(bucketKey) || []).filter((t) => t > cutoff);
    if (timestamps.length >= max) {
      const oldest = timestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: message || 'Too many requests. Please wait a moment and try again.',
        retryAfterSeconds: retryAfterSec
      });
    }

    timestamps.push(now);
    buckets.set(bucketKey, timestamps);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - timestamps.length)));
    next();
  };
}
