/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise Utility Routes: TTS Speech Stream & Admin Diagnostics.
 * Public database dump/overwrite endpoints (/api/db, /api/db-state, /api/db-sync)
 * have been removed to prevent unauthorized PII & account data exposure.
 */

import { Router } from 'express';
import { getDb, syncWithFirebase } from '../db';
import { synthesizeSpeech } from '../ttsService';
import { sendCandidateEmail } from '../emailService';
import { requireAuth, requireRole, tryAuthenticateRequest, logAuditEvent } from '../authMiddleware';
import { createRateLimiter } from '../securityMiddleware';

export const utilityRouter = Router();

const MAX_TTS_CHARS = 1200;

const ttsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 500 : 60,
  keyPrefix: 'tts',
  message: 'Too many speech synthesis requests. Please wait a moment and try again.'
});

// Text-to-Speech Streaming Synthesis Endpoint (protected by session or active candidate token + length cap)
utilityRouter.get('/tts', ttsRateLimiter, async (req, res) => {
  const authUser = tryAuthenticateRequest(req);
  const tokenParam = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!authUser) {
    if (!tokenParam) {
      return res.status(401).json({ error: 'Authentication or an active interview token is required for speech synthesis.' });
    }
    const isDemo = tokenParam === 'demo' || tokenParam === 'demo-test-token';
    if (!isDemo) {
      const db = getDb();
      const candidate = db.candidates.find((c) => c.token === tokenParam);
      if (!candidate) {
        return res.status(401).json({ error: 'Invalid interview token for speech synthesis.' });
      }
      if (candidate.status === 'Completed' || candidate.status === 'Suspended') {
        return res.status(409).json({ error: 'Interview session is already finalized.' });
      }
      if (candidate.tokenExpiresAt && Date.now() > Date.parse(candidate.tokenExpiresAt)) {
        return res.status(410).json({ error: 'Interview invite link has expired.' });
      }
    }
  }

  const text = typeof req.query.text === 'string' ? req.query.text.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (text.length > MAX_TTS_CHARS) {
    return res.status(413).json({
      error: `Speech synthesis text exceeds maximum limit of ${MAX_TTS_CHARS} characters.`
    });
  }

  try {
    const result = await synthesizeSpeech(text);
    if (!result || !result.buffer) {
      return res.status(500).send('Failed to synthesize speech');
    }

    res.set({
      'Content-Type': result.mimeType || 'audio/wav',
      'Content-Length': result.buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600'
    });

    return res.send(result.buffer);
  } catch (err) {
    console.error('[TTS FATAL ERROR]', err);
    return res.status(500).send('Internal TTS error');
  }
});

// Admin ONLY: Manual Firebase Firestore Sync Trigger
utilityRouter.post('/db/sync-firebase', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const db = getDb();
    const result = await syncWithFirebase(db);
    logAuditEvent('ADMIN_FIREBASE_SYNC', req.authUser!);
    res.json(result);
  } catch (err: any) {
    console.error('[FIREBASE SYNC ENDPOINT ERROR]', err);
    res.status(500).json({ success: false, error: err.message || 'Firebase Sync Exception' });
  }
});

// Authenticated Recruiter/Admin: Test Email Dispatcher
utilityRouter.post('/test-email', requireAuth, async (req, res) => {
  const toEmail = (req.body.toEmail || req.body.email || '').toString().trim();
  const candidateName = req.body.candidateName || req.body.name || 'Candidate';

  if (!toEmail) {
    return res.status(400).json({ error: 'Recipient email address (toEmail or email) is required.' });
  }

  try {
    const startLink = `${process.env.APP_URL || 'http://localhost:3000'}/?token=demo-test-token`;
    const result = await sendCandidateEmail(toEmail, candidateName, 'INVITATION', {
      assessmentTitle: 'Senior Full Stack Engineer Diagnostic',
      startLink
    });

    const responsePayload = {
      ...result,
      message: result.mode === 'sent'
        ? `Test email was successfully dispatched to ${toEmail} via Brevo transactional service!`
        : `Email delivery executed in simulated sandbox mode. Set BREVO_API_KEY to send live emails.`
    };

    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
