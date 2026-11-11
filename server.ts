/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * kreo AI Enterprise Core Server Entrypoint.
 * Modular, production-ready Express server with Vite middleware integration.
 */

import express from 'express';
import path from 'path';

// Import modular domain routes
import { authRouter } from './server/routes/authRoutes';
import { candidateRouter } from './server/routes/candidateRoutes';
import { assessmentRouter } from './server/routes/assessmentRoutes';
import { interviewRouter } from './server/routes/interviewRoutes';
import { utilityRouter } from './server/routes/utilityRoutes';
import { questionBankRouter } from './server/routes/questionBankRoutes';

// Import storage & services
import { recordingsDir, runRecordingsCleanup } from './server/s3Storage';
import { isGroqConfigured } from './server/groq';

const app = express();
const PORT = 3000;

// Enable CORS and High-Capacity JSON parser for handling resume base64 data & transcripts
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'kreo AI',
    timestamp: new Date().toISOString(),
    aiProviders: {
      gemini: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      groqFallback: isGroqConfigured()
    }
  });
});

// Mount Enterprise API Domain Routers
app.use('/api/auth', authRouter);
app.use('/api/candidates', candidateRouter);
app.use('/api/assessments', assessmentRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/question-bank', questionBankRouter);
app.use('/api', utilityRouter);

/**
 * Server Lifecycle & Asset Pipeline Orchestrator
 */
const startServer = async () => {
  // 1. Audit Gemini & Groq AI Model Engine Status
  const apiKeyStatus = process.env.GEMINI_API_KEY;
  if (!apiKeyStatus) {
    console.log('[GEMINI STATUS] Key is UNDEFINED / MISSING');
  } else if (apiKeyStatus === 'MY_GEMINI_API_KEY' || apiKeyStatus.includes('YOUR_')) {
    console.log('[GEMINI STATUS] Key is a placeholder token');
  } else {
    console.log(`[GEMINI STATUS] Key is ACTIVE (length: ${apiKeyStatus.length}, prefix: ${apiKeyStatus.substring(0, 4)}...)`);
  }

  const groqStatus = process.env.GROQ_API_KEY;
  if (!groqStatus) {
    console.log('[GROQ FALLBACK STATUS] Key is UNDEFINED / MISSING');
  } else if (groqStatus === 'MY_GROQ_API_KEY' || groqStatus.includes('YOUR_')) {
    console.log('[GROQ FALLBACK STATUS] Key is a placeholder token');
  } else {
    console.log(`[GROQ FALLBACK STATUS] Key is ACTIVE (length: ${groqStatus.length}, prefix: ${groqStatus.substring(0, 4)}...) - Llama 3.3 70B & 3.1 8B failsafe ready`);
  }

  // 2. Run automated audio/video recording retention cleanup
  try {
    runRecordingsCleanup();
  } catch (err) {
    console.error('[CLEANUP] Initial boot recordings cleanup error:', err);
  }

  // 3. Serve interview audio/video recordings directory statically
  app.use('/recordings', express.static(recordingsDir));

  // 4. Vite Middleware in Development, Static Serving in Production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 5. Bind listener to 0.0.0.0:3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`kreo AI Engine Live on port ${PORT}`);
  });
};

startServer();
