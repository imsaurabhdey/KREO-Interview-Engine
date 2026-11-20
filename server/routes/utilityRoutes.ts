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
import { requireAuth, requireRole, logAuditEvent } from '../authMiddleware';

export const utilityRouter = Router();

// Text-to-Speech Streaming Synthesis Endpoint (used by candidate interview voice)
utilityRouter.get('/tts', async (req, res) => {
  const text = req.query.text as string;
  if (!text || !text.trim()) {
    return res.status(400).send('Text is required');
  }

  try {
    const result = await synthesizeSpeech(text);
    if (!result || !result.buffer) {
      return res.status(500).send('Failed to synthesize speech');
    }

    res.set({
      'Content-Type': result.mimeType || 'audio/wav',
      'Content-Length': result.buffer.length.toString(),
      'Cache-Control': 'public, max-age=86400'
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
