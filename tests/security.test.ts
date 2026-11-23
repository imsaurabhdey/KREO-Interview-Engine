/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Automated Security, Authorization, Privacy, Validation & Code-Execution Test Suite.
 * Runs against an isolated temporary DB file so live db.json is never modified.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { hashPassword, resetDbCacheForTests, getDb } from '../server/db';
import { recordingsDir } from '../server/s3Storage';
import { createApp } from '../server';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kreo-security-test-'));
const tempDbPath = path.join(tmpDir, 'test-db.json');

process.env.DB_PATH_OVERRIDE = tempDbPath;
process.env.SESSION_SECRET = 'test-session-secret-for-automated-suite-32chars';

let server: http.Server;
let baseUrl = '';
let adminToken = '';
let recruiterToken = '';
let otherOrgToken = '';

const seededDb = {
  accounts: [
    {
      id: 'usr-admin-1',
      name: 'Saurabh Dey',
      email: 'saurabh.dey@irissoftware.com',
      passwordHash: hashPassword('AdminPass!123'),
      role: 'Admin',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-rec-1',
      name: 'Recruiter One',
      email: 'recruiter@irissoftware.com',
      passwordHash: hashPassword('RecPass!123'),
      role: 'Recruiter',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-other-org',
      name: 'External Recruiter',
      email: 'lead@othercorp.com',
      passwordHash: hashPassword('OtherPass!123'),
      role: 'Admin',
      orgName: 'Other Corp',
      createdAt: new Date().toISOString()
    }
  ],
  assessments: [
    {
      id: 'asmt-org-a',
      title: 'Backend Engineer',
      roleLevel: 'Senior',
      experienceRequired: '5+ Years',
      jdText: 'Node.js, TypeScript, SQL',
      skillsExtracted: ['Node.js', 'TypeScript'],
      status: 'Published',
      createdAt: new Date().toISOString(),
      orgName: 'Kreo Software',
      questions: []
    },
    {
      id: 'asmt-org-b',
      title: 'Other Org Role',
      roleLevel: 'Mid-Level',
      experienceRequired: '3 Years',
      jdText: 'Python',
      skillsExtracted: ['Python'],
      status: 'Published',
      createdAt: new Date().toISOString(),
      orgName: 'Other Corp',
      questions: []
    }
  ],
  candidates: [
    {
      id: 'cand-active-1',
      name: 'Active Candidate',
      email: 'active@example.com',
      phone: '9999999999',
      assessmentId: 'asmt-org-a',
      status: 'In Progress',
      token: 'tok-active-1',
      orgName: 'Kreo Software',
      feedbackReport: {
        decision: 'Hire',
        summary: 'Strong backend skills',
        technicalScore: 85,
        communicationScore: 80,
        problemSolvingScore: 82,
        cheatingRisk: 'Low',
        cheatingLogs: [],
        transcripts: [
          {
            questionId: 'q1',
            category: 'tech',
            questionText: 'Explain event loop',
            candidateAnswer: 'Detailed secret verbatim answer',
            aiEvaluation: 'Strong',
            score: 88
          }
        ]
      }
    },
    {
      id: 'cand-completed-1',
      name: 'Completed Candidate',
      email: 'done@example.com',
      phone: '8888888888',
      assessmentId: 'asmt-org-a',
      status: 'Completed',
      token: 'tok-completed-1',
      orgName: 'Kreo Software'
    }
  ],
  questionBank: [
    {
      id: 'qb-1',
      skill: 'Node.js',
      difficulty: 'Moderate',
      category: 'Technical',
      question: 'Explain how streams work in Node.js and backpressure handling.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      revisions: []
    }
  ]
};

before(async () => {
  fs.writeFileSync(tempDbPath, JSON.stringify(seededDb, null, 2), 'utf-8');
  resetDbCacheForTests();

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  // Obtain verified session tokens for each persona
  const login = async (email: string, password: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    return data.token as string;
  };

  adminToken = await login('saurabh.dey@irissoftware.com', 'AdminPass!123');
  recruiterToken = await login('recruiter@irissoftware.com', 'RecPass!123');
  otherOrgToken = await login('lead@othercorp.com', 'OtherPass!123');
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Unauthenticated requests are denied (401) and public DB dump routes return 404', async () => {
  for (const endpoint of ['/api/candidates', '/api/assessments', '/api/auth/users', '/api/question-bank/skills']) {
    const res = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(res.status, 401, `${endpoint} should require authentication`);
  }

  for (const removed of ['/api/db', '/api/db-state', '/api/db-sync']) {
    const res = await fetch(`${baseUrl}${removed}`);
    assert.equal(res.status, 404, `${removed} should be permanently removed`);
  }
});

test('2. Role isolation: Recruiter cannot escalate via forged x-user-role header or call Admin endpoints', async () => {
  const headers = {
    Authorization: `Bearer ${recruiterToken}`,
    'x-user-role': 'Admin',
    'Content-Type': 'application/json'
  };

  const usersRes = await fetch(`${baseUrl}/api/auth/users`, { headers });
  assert.equal(usersRes.status, 403);

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Rogue', email: 'rogue@irissoftware.com', password: 'Password123', role: 'Admin' })
  });
  assert.equal(registerRes.status, 403);

  const delAsmtRes = await fetch(`${baseUrl}/api/assessments/asmt-org-a`, {
    method: 'DELETE',
    headers
  });
  assert.equal(delAsmtRes.status, 403);

  const delQbRes = await fetch(`${baseUrl}/api/question-bank/questions/qb-1`, {
    method: 'DELETE',
    headers
  });
  assert.equal(delQbRes.status, 403);
});

test('3. Organization isolation and candidate list transcript projection vs full detail', async () => {
  // Other org cannot see Kreo Software candidates or assessments
  const otherCandsRes = await fetch(`${baseUrl}/api/candidates`, {
    headers: { Authorization: `Bearer ${otherOrgToken}` }
  });
  assert.equal(otherCandsRes.status, 200);
  const otherCands = await otherCandsRes.json();
  assert.equal(otherCands.length, 0);

  const otherDetailRes = await fetch(`${baseUrl}/api/candidates/cand-active-1`, {
    headers: { Authorization: `Bearer ${otherOrgToken}` }
  });
  assert.equal(otherDetailRes.status, 404);

  // Kreo Software list endpoint omits verbatim transcripts
  const listRes = await fetch(`${baseUrl}/api/candidates`, {
    headers: { Authorization: `Bearer ${recruiterToken}` }
  });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  const activeSummary = list.find((c: any) => c.id === 'cand-active-1');
  assert.ok(activeSummary);
  assert.deepEqual(activeSummary.feedbackReport.transcripts, []);

  // Detail endpoint returns full transcripts
  const detailRes = await fetch(`${baseUrl}/api/candidates/cand-active-1`, {
    headers: { Authorization: `Bearer ${recruiterToken}` }
  });
  assert.equal(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.equal(detail.feedbackReport.transcripts.length, 1);
  assert.equal(detail.feedbackReport.transcripts[0].candidateAnswer, 'Detailed secret verbatim answer');
});

test('4. Authenticated bcrypt change-password rejects wrong password and succeeds with valid password', async () => {
  const wrongRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recruiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ oldPassword: 'WrongPassword', newPassword: 'NewPassword!123' })
  });
  assert.equal(wrongRes.status, 401);

  const okRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recruiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ oldPassword: 'RecPass!123', newPassword: 'NewPassword!123' })
  });
  assert.equal(okRes.status, 200);

  // Confirm login works with new password
  const relogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'recruiter@irissoftware.com', password: 'NewPassword!123' })
  });
  assert.equal(relogin.status, 200);
});

test('5. Assessment schema validation, allowed status transitions, and auditHistory tracking', async () => {
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  // Invalid status rejected
  const invalidStatus = await fetch(`${baseUrl}/api/assessments/asmt-org-a`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'InvalidState' })
  });
  assert.equal(invalidStatus.status, 400);

  // Move Published -> Closed (allowed)
  const closeRes = await fetch(`${baseUrl}/api/assessments/asmt-org-a`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'Closed' })
  });
  assert.equal(closeRes.status, 200);
  const closedAsmt = await closeRes.json();
  assert.equal(closedAsmt.status, 'Closed');
  assert.equal(closedAsmt.updatedByEmail, 'saurabh.dey@irissoftware.com');
  assert.ok(Array.isArray(closedAsmt.auditHistory) && closedAsmt.auditHistory.length >= 1);

  // Move Closed -> Draft (forbidden state transition)
  const badTransition = await fetch(`${baseUrl}/api/assessments/asmt-org-a`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'Draft' })
  });
  assert.equal(badTransition.status, 400);

  // Reopen Closed -> Published (allowed) so active candidate tests work
  const reopenRes = await fetch(`${baseUrl}/api/assessments/asmt-org-a`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'Published' })
  });
  assert.equal(reopenRes.status, 200);
});

test('6. Question bank validation and revision versioning on updates', async () => {
  const headers = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  const badCreate = await fetch(`${baseUrl}/api/question-bank/questions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ skill: 'Go', question: 'Hi' }) // too short
  });
  assert.equal(badCreate.status, 400);

  const editRes = await fetch(`${baseUrl}/api/question-bank/questions/qb-1`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      question: 'Explain Node.js Readable/Writable streams and how highWaterMark prevents memory spikes.'
    })
  });
  assert.equal(editRes.status, 200);
  const edited = await editRes.json();
  assert.equal(edited.question.version, 2);
  assert.equal(edited.question.revisions.length, 1);
  assert.equal(edited.question.revisions[0].editedByEmail, 'saurabh.dey@irissoftware.com');
});

test('7. Code execution route enforces token/session authorization, size cap, and language allowlist', async () => {
  // Invalid token rejected
  const invalidTokenRes = await fetch(`${baseUrl}/api/interview/fake-token/execute-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'console.log(1);', language: 'javascript' })
  });
  assert.equal(invalidTokenRes.status, 401);

  // Unauthenticated demo token rejected
  const unauthDemoRes = await fetch(`${baseUrl}/api/interview/demo/execute-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'console.log(1);', language: 'javascript' })
  });
  assert.equal(unauthDemoRes.status, 401);

  // Completed candidate token rejected
  const completedRes = await fetch(`${baseUrl}/api/interview/tok-completed-1/execute-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'console.log(1);', language: 'javascript' })
  });
  assert.equal(completedRes.status, 403);

  // Oversized code (>20 KB) rejected with 413
  const bigCode = 'a'.repeat(21_000);
  const bigRes = await fetch(`${baseUrl}/api/interview/tok-active-1/execute-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: bigCode, language: 'javascript' })
  });
  assert.equal(bigRes.status, 413);

  // Unsupported language rejected with 400
  const badLangRes = await fetch(`${baseUrl}/api/interview/tok-active-1/execute-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'print(1)', language: 'cobol-99' })
  });
  assert.equal(badLangRes.status, 400);
});

test('8. Operations safety rails: security headers, restricted CORS, and 2 MB default body limit', async () => {
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(healthRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(healthRes.headers.get('x-powered-by'), null);

  // Unauthorized cross-origin request rejected with 403
  const evilCorsRes = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://evil-attacker.example' }
  });
  assert.equal(evilCorsRes.status, 403);

  // Default 2 MB JSON limit enforced on standard API routes
  const hugePayload = JSON.stringify({ title: 'X', jdText: 'x'.repeat(2_200_000) });
  const largeRes = await fetch(`${baseUrl}/api/assessments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: hugePayload
  });
  assert.equal(largeRes.status, 413);
});

test('9. Interview recordings require authentication and enforce organization ownership', async () => {
  const testRecordingName = `test-sec-recording-${Date.now()}.webm`;
  const testRecordingPath = path.join(recordingsDir, testRecordingName);
  fs.writeFileSync(testRecordingPath, Buffer.from('mock-webm-video-bytes'));

  try {
    const db = getDb();
    const cand = db.candidates.find((c) => c.id === 'cand-active-1');
    assert.ok(cand);
    cand.recordingUrl = `/recordings/${testRecordingName}`;

    // Unauthenticated viewer rejected (401)
    const unauthRes = await fetch(`${baseUrl}/recordings/${testRecordingName}`);
    assert.equal(unauthRes.status, 401);

    // Authenticated user from a different organization rejected (403)
    const otherOrgRes = await fetch(`${baseUrl}/recordings/${testRecordingName}`, {
      headers: { Authorization: `Bearer ${otherOrgToken}` }
    });
    assert.equal(otherOrgRes.status, 403);

    // Authorized recruiter from the same organization allowed (200) with no-store header
    const sameOrgRes = await fetch(`${baseUrl}/recordings/${testRecordingName}`, {
      headers: { Authorization: `Bearer ${recruiterToken}` }
    });
    assert.equal(sameOrgRes.status, 200);
    assert.equal(sameOrgRes.headers.get('cache-control'), 'private, no-store');
    const body = await sameOrgRes.text();
    assert.equal(body, 'mock-webm-video-bytes');
  } finally {
    if (fs.existsSync(testRecordingPath)) {
      fs.unlinkSync(testRecordingPath);
    }
  }
});

test('10. Password reset codes are invalidated after 5 failed verification attempts', async () => {
  const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'recruiter@irissoftware.com' })
  });
  assert.equal(forgotRes.status, 200);
  const forgotData = await forgotRes.json();
  const match = String(forgotData.message || '').match(/\b(\d{6})\b/);
  assert.ok(match, 'Development sandbox mode should return the 6-digit reset code for test verification');
  const realCode = match[1];
  const wrongCode = realCode === '000000' ? '111111' : '000000';

  for (let i = 1; i <= 4; i++) {
    const badRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recruiter@irissoftware.com',
        code: wrongCode,
        newPassword: 'AttemptedNewPassword!1'
      })
    });
    assert.equal(badRes.status, 400);
  }

  // 5th wrong attempt invalidates the reset code with 429
  const fifthRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'recruiter@irissoftware.com',
      code: wrongCode,
      newPassword: 'AttemptedNewPassword!1'
    })
  });
  assert.equal(fifthRes.status, 429);

  // Even the real code is now rejected because it was invalidated
  const afterLockoutRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'recruiter@irissoftware.com',
      code: realCode,
      newPassword: 'AttemptedNewPassword!1'
    })
  });
  assert.equal(afterLockoutRes.status, 400);
});

test('11. Human recruiter review override & invite link re-issuance enforce org scoping and completion locks', async () => {
  // Invalid decision rejected
  const badReview = await fetch(`${baseUrl}/api/candidates/cand-active-1/human-review`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${recruiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ decision: 'MaybeLater', notes: 'test' })
  });
  assert.equal(badReview.status, 400);

  // Cross-org human review rejected (404)
  const crossOrgReview = await fetch(`${baseUrl}/api/candidates/cand-active-1/human-review`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${otherOrgToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ decision: 'Rejected', notes: 'unauthorized' })
  });
  assert.equal(crossOrgReview.status, 404);

  // Valid human review saves decision, notes, reviewer metadata, and syncs selectionStatus
  const okReview = await fetch(`${baseUrl}/api/candidates/cand-active-1/human-review`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${recruiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ decision: 'Shortlisted', notes: 'Strong system design depth in walkthrough.' })
  });
  assert.equal(okReview.status, 200);
  const reviewData = await okReview.json();
  assert.equal(reviewData.candidate.humanReview.decision, 'Shortlisted');
  assert.equal(reviewData.candidate.humanReview.reviewedByEmail, 'recruiter@irissoftware.com');
  assert.equal(reviewData.candidate.selectionStatus, 'Selected');

  // Re-issuing invite on finalized candidate is blocked (409)
  const reissueCompleted = await fetch(`${baseUrl}/api/candidates/cand-completed-1/reissue-invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recruiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sendEmail: false })
  });
  assert.equal(reissueCompleted.status, 409);

  // Re-issuing invite on active/pending candidate rotates token & extends expiry
  const reissueActive = await fetch(`${baseUrl}/api/candidates/cand-active-1/reissue-invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recruiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sendEmail: false })
  });
  assert.equal(reissueActive.status, 200);
  const reissuedData = await reissueActive.json();
  assert.notEqual(reissuedData.candidate.token, 'tok-active-1');
  assert.ok(reissuedData.candidate.token.length >= 36);
  assert.ok(Date.parse(reissuedData.tokenExpiresAt) > Date.now());
});

test('12. TTS endpoint requires valid token or session, blocks finalized sessions, and caps text length', async () => {
  const unauthTts = await fetch(`${baseUrl}/api/tts?text=Hello`);
  assert.equal(unauthTts.status, 401);

  const invalidTokenTts = await fetch(`${baseUrl}/api/tts?token=tok-fake&text=Hello`);
  assert.equal(invalidTokenTts.status, 401);

  const completedTokenTts = await fetch(`${baseUrl}/api/tts?token=tok-completed-1&text=Hello`);
  assert.equal(completedTokenTts.status, 409);

  const tooLongText = 'a'.repeat(1300);
  const tooLongTts = await fetch(`${baseUrl}/api/tts?text=${tooLongText}`, {
    headers: { Authorization: `Bearer ${recruiterToken}` }
  });
  assert.equal(tooLongTts.status, 413);
});

test('13. Password strength policy rejects weak passwords on user registration and change-password', async () => {
  const weakRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Weak User',
      email: 'weak@irissoftware.com',
      password: 'password',
      role: 'Recruiter'
    })
  });
  assert.equal(weakRegister.status, 400);

  const shortChange = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      oldPassword: 'AdminPass!123',
      newPassword: 'Ab1'
    })
  });
  assert.equal(shortChange.status, 400);
});


