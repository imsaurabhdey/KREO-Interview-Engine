/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise User Authentication & Corporate Account Management Routes.
 */

import crypto from 'crypto';
import { Router } from 'express';
import { getDb, saveDb, hashPassword, verifyPassword } from '../db';
import { UserAccount, UserRole } from '../types';
import { sendPasswordResetEmail } from '../emailService';
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireRole,
  canAccessOrg,
  logAuditEvent
} from '../authMiddleware';
import { createRateLimiter } from '../securityMiddleware';

export const authRouter = Router();

const authAttemptLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 500 : 30,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait a few minutes and try again.'
});

interface PasswordResetEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const MAX_RESET_ATTEMPTS = 5;

// In-memory verification code store for password resets
const passwordResetStore = new Map<string, PasswordResetEntry>();

function constantTimeCodeMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(provided, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isPrimaryProtectedAdmin(email: string): boolean {
  const bootstrapEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const normalized = email.toLowerCase().trim();
  return normalized === 'saurabh.dey@irissoftware.com' || (Boolean(bootstrapEmail) && normalized === bootstrapEmail);
}

// Login endpoint with OWASP-compliant bcrypt verification & server-signed session
authRouter.post('/login', authAttemptLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Corporate email and password are required.' });
  }

  const db = getDb();
  const userEmail = String(email).toLowerCase().trim();
  const matchedUser = db.accounts.find(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (!matchedUser || !verifyPassword(String(password), matchedUser.passwordHash)) {
    return res.status(401).json({ error: 'Verification failed. Invalid email, password, or security credentials.' });
  }

  const sessionToken = createSessionToken(matchedUser);
  setSessionCookie(req, res, sessionToken);

  const { passwordHash, ...safeUser } = matchedUser;
  logAuditEvent('AUTH_LOGIN', {
    email: matchedUser.email,
    role: matchedUser.role,
    orgName: matchedUser.orgName || 'Kreo Software'
  });

  res.json({ success: true, token: sessionToken, user: safeUser });
});

// Verify active server-side session
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.authUser });
});

// Logout & clear HttpOnly session cookie
authRouter.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ success: true });
});

// Forgot password endpoint: initiates OTP verification code via Brevo email
authRouter.post('/forgot-password', authAttemptLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Corporate email address is required.' });
  }

  const db = getDb();
  const userEmail = String(email).toLowerCase().trim();
  const matchedUser = db.accounts.find(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (!matchedUser) {
    return res.status(404).json({ error: 'No corporate account found matching this email address.' });
  }

  // Generate cryptographically secure 6-digit verification code
  const resetCode = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  passwordResetStore.set(userEmail, { code: resetCode, expiresAt, attempts: 0 });

  try {
    const emailResult = await sendPasswordResetEmail(matchedUser.email, matchedUser.name, resetCode);
    if (emailResult.mode !== 'sent' && process.env.NODE_ENV === 'production') {
      passwordResetStore.delete(userEmail);
      return res.status(503).json({
        error: 'Email delivery is not configured in production. Contact an administrator to reset your password.'
      });
    }
    res.json({
      success: true,
      mode: emailResult.mode,
      message: emailResult.mode === 'sent'
        ? `A 6-digit password reset verification code has been dispatched to ${userEmail}.`
        : `Verification code generated: ${resetCode} (development sandbox mode).`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to dispatch verification email. Please try again.' });
  }
});

// Verify reset code and update password
authRouter.post('/reset-password', authAttemptLimiter, (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, 6-digit code, and new password are required.' });
  }

  const userEmail = String(email).toLowerCase().trim();
  const resetRecord = passwordResetStore.get(userEmail);

  if (!resetRecord) {
    return res.status(400).json({ error: 'No active password reset request found. Please request a new code.' });
  }

  if (Date.now() > resetRecord.expiresAt) {
    passwordResetStore.delete(userEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  const providedCode = String(code).trim();
  if (!constantTimeCodeMatch(resetRecord.code, providedCode)) {
    resetRecord.attempts += 1;
    if (resetRecord.attempts >= MAX_RESET_ATTEMPTS) {
      passwordResetStore.delete(userEmail);
      return res.status(429).json({
        error: 'Too many incorrect verification attempts. Code invalidated — please request a new verification code.'
      });
    }
    const remaining = MAX_RESET_ATTEMPTS - resetRecord.attempts;
    return res.status(400).json({
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
    });
  }

  const db = getDb();
  const matchedUserIndex = db.accounts.findIndex(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (matchedUserIndex === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  db.accounts[matchedUserIndex].passwordHash = hashPassword(String(newPassword));
  saveDb(db, true);
  passwordResetStore.delete(userEmail);

  logAuditEvent('AUTH_PASSWORD_RESET', {
    email: userEmail,
    role: db.accounts[matchedUserIndex].role,
    orgName: db.accounts[matchedUserIndex].orgName
  });

  res.json({ success: true, message: 'Password has been reset successfully. You can now login.' });
});

// Change password endpoint (strictly authenticated to the logged-in user)
authRouter.post('/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const db = getDb();
  const userEmail = req.authUser!.email;
  const matchedUserIndex = db.accounts.findIndex(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (matchedUserIndex === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const matchedUser = db.accounts[matchedUserIndex];
  if (!verifyPassword(String(oldPassword), matchedUser.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  matchedUser.passwordHash = hashPassword(String(newPassword));
  saveDb(db, true);

  logAuditEvent('AUTH_PASSWORD_CHANGED', req.authUser!);
  res.json({ success: true, message: 'Password has been changed successfully.' });
});

// Admin ONLY: Provision new corporate account (no public self-assigned roles)
authRouter.post('/register', requireAuth, requireRole('Admin'), (req, res) => {
  const { name, email, password, role, orgName } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const validatedRole: UserRole = role === 'Admin' ? 'Admin' : 'Recruiter';
  const db = getDb();
  const userEmail = String(email).toLowerCase().trim();
  const alreadyExists = db.accounts.find(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (alreadyExists) {
    return res.status(409).json({ error: 'Email matches an active corporate user. Proceed to Login instead.' });
  }

  const resolvedOrgName = (typeof orgName === 'string' && orgName.trim())
    ? orgName.trim()
    : req.authUser!.orgName;

  const newUser: UserAccount = {
    id: `usr-${Date.now()}`,
    name: String(name).trim(),
    email: userEmail,
    passwordHash: hashPassword(String(password)),
    role: validatedRole,
    orgName: resolvedOrgName,
    createdAt: new Date().toISOString()
  };

  db.accounts.push(newUser);
  saveDb(db, true);

  logAuditEvent('ADMIN_CREATE_USER', req.authUser!, {
    createdEmail: newUser.email,
    assignedRole: newUser.role,
    assignedOrg: newUser.orgName
  });

  const { passwordHash, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// Admin ONLY: Fetch registered users scoped to organization (never returns password hashes)
authRouter.get('/users', requireAuth, requireRole('Admin'), (req, res) => {
  const db = getDb();
  const safeUsers = (db.accounts || [])
    .filter((acc) => canAccessOrg(req.authUser!, acc.orgName))
    .map(({ id, name, email, role, orgName, createdAt }) => ({
      id,
      name,
      email,
      role,
      orgName,
      createdAt
    }));
  res.json(safeUsers);
});

// Admin ONLY: Toggle role of registered user within organization
authRouter.post('/users/:email/toggle-role', requireAuth, requireRole('Admin'), (req, res) => {
  const { email } = req.params;
  const userEmail = email.toLowerCase().trim();

  if (isPrimaryProtectedAdmin(userEmail)) {
    return res.status(403).json({ error: 'Primary Admin account cannot be unseated.' });
  }

  if (userEmail === req.authUser!.email) {
    return res.status(403).json({ error: 'You cannot change your own role while logged in.' });
  }

  const db = getDb();
  const userIndex = db.accounts.findIndex((acc) => acc.email.toLowerCase().trim() === userEmail);
  if (userIndex === -1 || !canAccessOrg(req.authUser!, db.accounts[userIndex].orgName)) {
    return res.status(404).json({ error: 'User registration not found.' });
  }

  const currentRole = db.accounts[userIndex].role;
  const nextRole: UserRole = currentRole === 'Admin' ? 'Recruiter' : 'Admin';
  db.accounts[userIndex].role = nextRole;
  saveDb(db, true);

  logAuditEvent('ADMIN_TOGGLE_ROLE', req.authUser!, {
    targetEmail: userEmail,
    previousRole: currentRole,
    newRole: nextRole
  });

  const { passwordHash, ...safeUser } = db.accounts[userIndex];
  res.json({ success: true, user: safeUser });
});

// Admin ONLY: Delete user from enterprise records within organization
authRouter.delete('/users/:email', requireAuth, requireRole('Admin'), (req, res) => {
  const { email } = req.params;
  const userEmail = email.toLowerCase().trim();

  if (isPrimaryProtectedAdmin(userEmail)) {
    return res.status(403).json({ error: 'Primary Admin account cannot be deleted.' });
  }

  if (userEmail === req.authUser!.email) {
    return res.status(403).json({ error: 'You cannot delete your currently active account.' });
  }

  const db = getDb();
  const index = db.accounts.findIndex((acc) => acc.email.toLowerCase().trim() === userEmail);
  if (index === -1 || !canAccessOrg(req.authUser!, db.accounts[index].orgName)) {
    return res.status(404).json({ error: 'User registration not found.' });
  }

  db.accounts.splice(index, 1);
  saveDb(db, true);

  logAuditEvent('ADMIN_DELETE_USER', req.authUser!, { targetEmail: userEmail });
  res.json({ success: true });
});
