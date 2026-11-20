/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Automated Evaluation Pipeline, Interview Completion & Compliance Guardrail Tests.
 * Runs against an isolated temporary DB file so live db.json is never modified.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { hashPassword, resetDbCacheForTests, getDb } from '../server/db';
import {
  evaluateAnswerQuality,
  computeCompositeScore,
  deriveDecisionFromScore,
  assessProctoringCompliance,
  mergeAuthoritativeTranscripts,
  finalizeInterviewEvaluation
} from '../server/evaluationService';
import { createApp } from '../server';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kreo-eval-test-'));
const tempDbPath = path.join(tmpDir, 'eval-test-db.json');

process.env.DB_PATH_OVERRIDE = tempDbPath;
process.env.SESSION_SECRET = 'test-session-secret-for-eval-suite-32chars';

let server: http.Server;
let baseUrl = '';
let adminToken = '';

const seededEvalDb = {
  accounts: [
    {
      id: 'usr-eval-admin',
      name: 'Saurabh Dey',
      email: 'saurabh.dey@irissoftware.com',
      passwordHash: hashPassword('EvalAdmin!123'),
      role: 'Admin',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    }
  ],
  assessments: [
    {
      id: 'asmt-eval-1',
      title: 'Senior Node.js Engineer',
      roleLevel: 'Senior',
      experienceRequired: '5+ Years',
      jdText: 'Node.js, TypeScript, Distributed Systems',
      skillsExtracted: ['Node.js', 'TypeScript'],
      mandatorySkills: ['Node.js', 'TypeScript'],
      status: 'Published',
      createdAt: new Date().toISOString(),
      orgName: 'Kreo Software',
      questions: [
        {
          id: 'q-tech-1',
          category: 'tech',
          question: 'Explain how the Node.js event loop schedules microtasks versus macrotasks.',
          difficulty: 'Moderate'
        },
        {
          id: 'q-code-1',
          category: 'coding',
          question: 'Implement a function that deduplicates an array of user objects by id.',
          difficulty: 'Moderate'
        }
      ]
    }
  ],
  candidates: [
    {
      id: 'cand-strong',
      name: 'Strong Candidate',
      email: 'strong@example.com',
      phone: '+91 9999900001',
      assessmentId: 'asmt-eval-1',
      status: 'In Progress',
      token: 'tok-strong-candidate',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    },
    {
      id: 'cand-superficial',
      name: 'Superficial Candidate',
      email: 'superficial@example.com',
      phone: '+91 9999900002',
      assessmentId: 'asmt-eval-1',
      status: 'In Progress',
      token: 'tok-superficial-candidate',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    },
    {
      id: 'cand-tamper',
      name: 'Tamper Candidate',
      email: 'tamper@example.com',
      phone: '+91 9999900003',
      assessmentId: 'asmt-eval-1',
      status: 'In Progress',
      token: 'tok-tamper-candidate',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    },
    {
      id: 'cand-compliance',
      name: 'Compliance Violation Candidate',
      email: 'violation@example.com',
      phone: '+91 9999900004',
      assessmentId: 'asmt-eval-1',
      status: 'In Progress',
      token: 'tok-compliance-candidate',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    }
  ],
  questionBank: []
};

before(async () => {
  // Ensure deterministic offline baseline behavior during unit tests
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;

  fs.writeFileSync(tempDbPath, JSON.stringify(seededEvalDb, null, 2), 'utf-8');
  resetDbCacheForTests();

  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'saurabh.dey@irissoftware.com',
      password: 'EvalAdmin!123'
    })
  });
  const loginData = await loginRes.json();
  adminToken = loginData.token;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Unified evaluator rejects superficial answers and scores structured technical & coding answers accurately', () => {
  const yesAnswer = evaluateAnswerQuality('yes', 'tech', 'Explain event loop');
  assert.equal(yesAnswer.isSuperficial, true);
  assert.ok(yesAnswer.score <= 10);

  const proseCode = evaluateAnswerQuality('I would probably loop over the list and remove duplicates using a set in memory.', 'coding');
  assert.ok(proseCode.score <= 15);

  const realCode = evaluateAnswerQuality(
    'function dedupeById(users) { const seen = new Set(); const out = []; for (const user of users) { if (!seen.has(user.id)) { seen.add(user.id); out.push(user); } } return out; }',
    'coding'
  );
  assert.equal(realCode.isSuperficial, false);
  assert.ok(realCode.score >= 75);

  const strongTech = evaluateAnswerQuality(
    'In Node.js the libuv event loop processes phases such as timers, pending callbacks, poll, check, and close callbacks, while draining the microtask queue including process.nextTick and resolved Promise callbacks between each phase boundary.',
    'tech'
  );
  assert.equal(strongTech.isSuperficial, false);
  assert.ok(strongTech.score >= 75);

  assert.equal(computeCompositeScore(80, 75, 78), Math.round(80 * 0.5 + 75 * 0.25 + 78 * 0.25));
  assert.equal(deriveDecisionFromScore(88), 'Strong Hire');
  assert.equal(deriveDecisionFromScore(78), 'Hire');
  assert.equal(deriveDecisionFromScore(62), 'Neutral');
  assert.equal(deriveDecisionFromScore(45), 'Reject');
  assert.equal(deriveDecisionFromScore(92, { hasCriticalComplianceViolation: true }), 'Reject');
});

test('2. Proctoring compliance flags critical camera-off and excessive tab switching violations', () => {
  const clean = assessProctoringCompliance({ tabSwitches: 0, cameraOffViolations: 0 }, false);
  assert.equal(clean.cheatingRisk, 'Low');
  assert.equal(clean.hasCriticalComplianceViolation, false);

  const violation = assessProctoringCompliance({ tabSwitches: 7, cameraOffViolations: 1 }, false);
  assert.equal(violation.cheatingRisk, 'High');
  assert.equal(violation.hasCriticalComplianceViolation, true);
  assert.ok(violation.cheatingLogs.length >= 2);
});

test('3. Server-persisted transcripts take precedence over tampered client answers at interview completion', () => {
  const merged = mergeAuthoritativeTranscripts(
    [
      {
        questionId: 'q-tech-1',
        category: 'tech',
        questionText: 'Explain event loop',
        candidateAnswer: 'yes',
        aiEvaluation: 'Pending final evaluation',
        score: 0
      }
    ],
    [
      {
        questionId: 'q-tech-1',
        category: 'tech',
        questionText: 'Explain event loop',
        candidateAnswer: 'A long fabricated answer injected in browser devtools right before submitting the interview form.',
        aiEvaluation: '',
        score: 99
      }
    ]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].candidateAnswer, 'yes');
});

test('4. End-to-end interview completion records auditable evaluationStatus, evaluationSource, and evaluationHistory', async () => {
  // Strong candidate completes interview via HTTP
  const resStrong = await fetch(`${baseUrl}/api/interview/tok-strong-candidate/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcripts: [
        {
          questionId: 'q-tech-1',
          category: 'tech',
          questionText: 'Explain how the Node.js event loop schedules microtasks versus macrotasks.',
          candidateAnswer:
            'Node.js uses libuv to run timers, I/O poll, and setImmediate check phases. After every callback completes, V8 drains process.nextTick and Promise microtasks before advancing to the next macrotask phase, preventing starvation when balanced carefully.'
        },
        {
          questionId: 'q-code-1',
          category: 'coding',
          questionText: 'Implement a function that deduplicates an array of user objects by id.',
          candidateAnswer:
            'function dedupeUsers(items) { const seen = new Set(); const result = []; for (const item of items) { if (item && !seen.has(item.id)) { seen.add(item.id); result.push(item); } } return result; }'
        }
      ],
      proctoringSummary: { tabSwitches: 0, browserFocusViolations: 0, faceDetectionsLost: 0 },
      isSuspended: false
    })
  });
  assert.equal(resStrong.status, 200);
  const strongCand = await resStrong.json();
  assert.equal(strongCand.status, 'Completed');
  assert.equal(strongCand.feedbackReport.decision, 'Hire');
  assert.equal(strongCand.feedbackReport.evaluationStatus, 'completed_baseline');
  assert.equal(strongCand.feedbackReport.evaluationSource, 'baseline_heuristic');
  assert.ok(Array.isArray(strongCand.feedbackReport.evaluationHistory));
  assert.equal(strongCand.feedbackReport.evaluationHistory.length, 1);
  assert.equal(strongCand.feedbackReport.evaluationHistory[0].stage, 'baseline_submitted');

  // Superficial candidate gets rejected cleanly without getting stuck on Review Pending
  const resSuperficial = await fetch(`${baseUrl}/api/interview/tok-superficial-candidate/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcripts: [
        { questionId: 'q-tech-1', category: 'tech', questionText: 'Explain event loop', candidateAnswer: 'yes' },
        { questionId: 'q-code-1', category: 'coding', questionText: 'Write dedupe', candidateAnswer: 'no' }
      ],
      proctoringSummary: { tabSwitches: 0 },
      isSuspended: false
    })
  });
  assert.equal(resSuperficial.status, 200);
  const supCand = await resSuperficial.json();
  assert.equal(supCand.feedbackReport.decision, 'Reject');
  assert.ok(supCand.aiAssessmentScore < 30);
});

test('5. Server-recorded /evaluate-answer transcripts cannot be overwritten during /complete', async () => {
  const evalAnswerRes = await fetch(`${baseUrl}/api/interview/tok-tamper-candidate/evaluate-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionId: 'q-tech-1',
      category: 'tech',
      questionText: 'Explain event loop',
      candidateAnswer: 'idk',
      isCrossAnswer: false
    })
  });
  assert.equal(evalAnswerRes.status, 200);

  const completeRes = await fetch(`${baseUrl}/api/interview/tok-tamper-candidate/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcripts: [
        {
          questionId: 'q-tech-1',
          category: 'tech',
          questionText: 'Explain event loop',
          candidateAnswer:
            'Here is a huge detailed textbook answer pasted into the client payload after already answering idk during the real interview.'
        }
      ],
      proctoringSummary: { tabSwitches: 0 },
      isSuspended: false
    })
  });
  assert.equal(completeRes.status, 200);
  const tamperedCand = await completeRes.json();
  assert.equal(tamperedCand.feedbackReport.transcripts[0].candidateAnswer, 'idk');
  assert.equal(tamperedCand.feedbackReport.decision, 'Reject');
});

test('6. Critical proctoring violation locks final verdict to Reject even with strong technical answers', () => {
  const result = finalizeInterviewEvaluation({
    candidateToken: 'tok-compliance-candidate',
    clientTranscripts: [
      {
        questionId: 'q-tech-1',
        category: 'tech',
        questionText: 'Explain event loop',
        candidateAnswer:
          'Node.js runs libuv event loop phases sequentially and drains microtasks including Promise callbacks and process.nextTick hooks between every phase transition in the runtime.',
        aiEvaluation: '',
        score: 0
      }
    ],
    proctoringSummary: { tabSwitches: 8, cameraOffViolations: 1 },
    isSuspended: false,
    queueAiAsync: false
  });

  assert.ok(result);
  assert.equal(result.candidate.feedbackReport?.cheatingRisk, 'High');
  assert.equal(result.candidate.feedbackReport?.decision, 'Reject');

  // Verify persisted in DB
  const saved = getDb().candidates.find((c) => c.token === 'tok-compliance-candidate');
  assert.equal(saved?.feedbackReport?.decision, 'Reject');
});

test('7. Production mode refuses fake ZIP resume candidate generation instead of silently returning demo fixtures', async () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await fetch(`${baseUrl}/api/candidates/extract-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        files: [
          {
            name: 'resumes.zip',
            type: 'application/zip',
            data: Buffer.from('PK\x03\x04fake').toString('base64')
          }
        ]
      })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /not enabled in production/i);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});
