/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise User Authentication & Corporate Account Management Routes.
 */

import { Router } from 'express';
import { getDb, saveDb, hashPassword, verifyPassword } from '../db';
import { UserAccount } from '../types';
import { sendPasswordResetEmail } from '../emailService';

export const authRouter = Router();

interface PasswordResetEntry {
  code: string;
  expiresAt: number;
}

// In-memory verification code store for password resets
const passwordResetStore = new Map<string, PasswordResetEntry>();

// Login endpoint with OWASP-compliant bcrypt verification
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Corporate email and password are required.' });
  }

  const db = getDb();
  const userEmail = email.toLowerCase().trim();
  const matchedUser = db.accounts.find(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (!matchedUser) {
    return res.status(401).json({ error: 'Verification failed. Invalid email, password, or security credentials.' });
  }

  if (!verifyPassword(password, matchedUser.passwordHash)) {
    return res.status(401).json({ error: 'Verification failed. Invalid email, password, or security credentials.' });
  }

  const { passwordHash, ...safeUser } = matchedUser;
  res.json({ success: true, user: safeUser });
});

// Forgot password endpoint: initiates OTP verification code via Brevo email
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Corporate email address is required.' });
  }

  const db = getDb();
  const userEmail = email.toLowerCase().trim();
  const matchedUser = db.accounts.find(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (!matchedUser) {
    return res.status(404).json({ error: 'No corporate account found matching this email address.' });
  }

  // Generate 6-digit cryptographic verification code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  passwordResetStore.set(userEmail, { code: resetCode, expiresAt });

  try {
    const emailResult = await sendPasswordResetEmail(matchedUser.email, matchedUser.name, resetCode);
    res.json({
      success: true,
      mode: emailResult.mode,
      message: emailResult.mode === 'sent'
        ? `A 6-digit password reset verification code has been dispatched to ${userEmail}.`
        : `Verification code generated: ${resetCode} (sandbox mode active). Check your console or enter code.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to dispatch verification email. Please try again.' });
  }
});

// Verify reset code and update password
authRouter.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, 6-digit code, and new password are required.' });
  }

  const userEmail = email.toLowerCase().trim();
  const resetRecord = passwordResetStore.get(userEmail);

  if (!resetRecord) {
    return res.status(400).json({ error: 'No active password reset request found. Please request a new code.' });
  }

  if (Date.now() > resetRecord.expiresAt) {
    passwordResetStore.delete(userEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  if (resetRecord.code !== code.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
  }

  const db = getDb();
  const matchedUserIndex = db.accounts.findIndex(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (matchedUserIndex === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  // Update password and clear reset code
  db.accounts[matchedUserIndex].passwordHash = hashPassword(newPassword);
  saveDb(db, true);
  passwordResetStore.delete(userEmail);

  res.json({ success: true, message: 'Password has been reset successfully. You can now login.' });
});

// Change password endpoint (authenticated)
authRouter.post('/change-password', (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Corporate email, current password, and new password are required.' });
  }

  const db = getDb();
  const userEmail = email.toLowerCase().trim();
  const matchedUserIndex = db.accounts.findIndex(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (matchedUserIndex === -1) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const matchedUser = db.accounts[matchedUserIndex];
  const oldHash = hashPassword(oldPassword);
  if (matchedUser.passwordHash !== oldHash) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  matchedUser.passwordHash = hashPassword(newPassword);
  saveDb(db, true);

  res.json({ success: true, message: 'Password has been changed successfully.' });
});

// User registration endpoint
authRouter.post('/register', (req, res) => {
  const { name, email, password, role, orgName } = req.body;
  if (!name || !email || !password || !role || !orgName) {
    return res.status(400).json({ error: 'All corporate workspace layout parameters are required.' });
  }

  const db = getDb();
  const userEmail = email.toLowerCase().trim();
  const alreadyExists = db.accounts.find(
    (acc) => acc.email.toLowerCase().trim() === userEmail
  );

  if (alreadyExists) {
    return res.status(409).json({ error: 'Email matches an active corporate user. Proceed to Login instead.' });
  }

  const newUser: UserAccount = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    email: userEmail,
    passwordHash: hashPassword(password),
    role,
    orgName: orgName.trim(),
    createdAt: new Date().toISOString()
  };

  db.accounts.push(newUser);
  saveDb(db, true);

  const { passwordHash, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// Admin ONLY: Fetch registered users
authRouter.get('/users', (req, res) => {
  const db = getDb();
  const safeUsers = db.accounts.map(({ id, name, email, role, orgName, createdAt }) => ({
    id,
    name,
    email,
    role,
    orgName,
    createdAt
  }));
  res.json(safeUsers);
});

// Admin ONLY: Toggle role of registered user
authRouter.post('/users/:email/toggle-role', (req, res) => {
  const { email } = req.params;
  const userEmail = email.toLowerCase().trim();

  if (userEmail === 'saurabh.dey@irisoftware.com') {
    return res.status(403).json({ error: 'Primary Admin account cannot be unseated.' });
  }

  const db = getDb();
  const asmtIndex = db.accounts.findIndex((acc) => acc.email.toLowerCase().trim() === userEmail);
  if (asmtIndex === -1) {
    return res.status(404).json({ error: 'User registration not found.' });
  }

  const currentRole = db.accounts[asmtIndex].role;
  db.accounts[asmtIndex].role = currentRole === 'Admin' ? 'Recruiter' : 'Admin';
  saveDb(db, true);

  const { passwordHash, ...safeUser } = db.accounts[asmtIndex];
  res.json({ success: true, user: safeUser });
});

// Admin ONLY: Delete user from enterprise records
authRouter.delete('/users/:email', (req, res) => {
  const { email } = req.params;
  const userEmail = email.toLowerCase().trim();

  if (userEmail === 'saurabh.dey@irisoftware.com') {
    return res.status(403).json({ error: 'Primary Admin account cannot be deleted.' });
  }

  const db = getDb();
  const index = db.accounts.findIndex((acc) => acc.email.toLowerCase().trim() === userEmail);
  if (index === -1) {
    return res.status(404).json({ error: 'User registration not found.' });
  }

  db.accounts.splice(index, 1);
  saveDb(db, true);
  res.json({ success: true });
});
