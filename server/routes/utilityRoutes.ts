/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Utility Routes: TTS Speech Stream, Database State/Sync & Email Diagnostics.
 */

import { Router } from 'express';
import { getDb, saveDb, syncWithFirebase } from '../db';
import { synthesizeSpeech } from '../ttsService';
import { sendCandidateEmail } from '../emailService';

export const utilityRouter = Router();

// Text-to-Speech Streaming Synthesis Endpoint
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

// Get Entire DB State (supports both /api/db and /api/db-state)
utilityRouter.get(['/db', '/db-state'], (req, res) => {
  const db = getDb();
  res.json(db);
});

// Update Entire DB State (supports /api/db, /api/db-sync, and /api/db-state)
utilityRouter.post(['/db', '/db-sync', '/db-state'], (req, res) => {
  const newDb = req.body;
  if (newDb) {
    const db = getDb();
    if (Array.isArray(newDb.assessments)) {
      db.assessments = newDb.assessments;
    }
    if (Array.isArray(newDb.candidates)) {
      db.candidates = newDb.candidates;
    }
    saveDb(db, true);
    return res.json({ success: true, count: db.assessments.length });
  }
  res.status(400).json({ error: 'Invalid DB structure' });
});

// Manual Firebase Firestore Sync Trigger
utilityRouter.post('/db/sync-firebase', async (req, res) => {
  try {
    const db = getDb();
    const result = await syncWithFirebase(db);
    res.json(result);
  } catch (err: any) {
    console.error('[FIREBASE SYNC ENDPOINT ERROR]', err);
    res.status(500).json({ success: false, error: err.message || 'Firebase Sync Exception' });
  }
});

// Test Email Dispatcher
utilityRouter.post('/test-email', async (req, res) => {
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
