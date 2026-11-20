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

// Import storage & security middleware
import { recordingsDir, runRecordingsCleanup } from './server/s3Storage';
import { isGroqConfigured } from './server/groq';
import {
  securityHeadersMiddleware,
  createCorsMiddleware,
  createRateLimiter,
  redactSensitiveData
} from './server/securityMiddleware';

const PORT = 3000;

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1. Security Headers & Restricted CORS Policy
  app.use(securityHeadersMiddleware);
  app.use(createCorsMiddleware());

  // 2. Scoped JSON Body Size Limits (25 MB only on resume/bank file-upload routes; 2 MB default everywhere else)
  const largePayloadParser = express.json({ limit: '25mb' });
  app.use('/api/candidates/extract-file', largePayloadParser);
  app.use('/api/question-bank/upload', largePayloadParser);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  // 3. General API Burst Rate Limiter
  const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 1000 : 300,
    keyPrefix: 'api',
    message: 'API rate limit exceeded. Please slow down and try again.'
  });
  app.use('/api', apiRateLimiter);

  // Health Check API
  app.get('/api/health', (_req, res) => {
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

  // Return 404 JSON for unknown/removed API endpoints instead of SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global Express JSON Error Handler with sensitive-field redaction
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    const logPayload = redactSensitiveData({
      method: req.method,
      path: req.originalUrl,
      status,
      error: err?.message || 'Internal server error'
    });
    console.error('[SERVER ERROR]', JSON.stringify(logPayload));

    if (res.headersSent) {
      return next(err);
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request payload is too large for this endpoint.' });
    }
    res.status(status).json({
      error: status >= 500 ? 'Internal server error' : (err?.message || 'Request error')
    });
  });

  return app;
}

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

/**
 * Server Lifecycle & Asset Pipeline Orchestrator
 */
const startServer = async () => {
  const app = createApp();

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
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 5. Bind listener to 0.0.0.0:3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`kreo AI Engine Live on port ${PORT}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
