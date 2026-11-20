/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Candidate Live Interview, Real-time Answer Processing & Proctoring Routes.
 */

import { Router } from 'express';
import { Type } from '@google/genai';
import { getDb, saveDb, shuffleWithSeed } from '../db';
import { getGeminiClient, generateContentWithFallback, cleanAndParseJSON, evaluateNeedsFollowUp, isGroqConfigured } from '../gemini';
import { executeCodeSandbox, MAX_CODE_BYTES, resolveSupportedLanguage } from '../codeExecution';
import { upload, uploadToR2 } from '../s3Storage';
import { sendCandidateEmail } from '../emailService';
import { finalizeInterviewEvaluation, evaluateAnswerQuality } from '../evaluationService';
import { tryAuthenticateRequest } from '../authMiddleware';
import { createRateLimiter } from '../securityMiddleware';

export { evaluateAnswerQuality };
export const interviewRouter = Router();

const codeExecutionLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  keyPrefix: 'code-exec',
  keyGenerator: (req) => `${req.params.token || 'unknown'}:${req.ip || 'ip'}`,
  message: 'Code execution rate limit reached (max 15 runs per 5 minutes). Please wait before running again.'
});

// Validate Candidate Token & Fetch Customized Assessment (supports both /:token/validate and /validate/:token)
interviewRouter.get(['/:token/validate', '/validate/:token'], (req, res) => {
  const token = req.params.token;
  const db = getDb();
  const candidate = db.candidates.find((c) => c.token === token);
  if (!candidate) {
    return res.status(404).json({ error: 'Interview access token is invalid or expired.' });
  }

  let assessment = db.assessments.find((a) => a.id === candidate.assessmentId);
  if (!assessment && db.assessments && db.assessments.length > 0) {
    assessment = db.assessments.find(a => a.status !== 'Closed') || db.assessments[0];
  }

  if (!assessment) {
    return res.status(404).json({ error: 'Assessment for this candidate token is not configured or has been deleted.' });
  }

  if (assessment.status === 'Closed') {
    return res.status(403).json({ error: 'This skill requisition has been closed. We are no longer accepting interviews for this position.' });
  }

  // Persistently extract a randomized subset of active questions for this candidate token
  const isTechEnabled = assessment.roundsEnabled?.tech !== false;
  const isCodingEnabled = assessment.roundsEnabled?.coding !== false;

  const techQuestions = isTechEnabled ? (assessment.questions || []).filter((q) => q.category === 'tech') : [];
  const codingQuestions = isCodingEnabled ? (assessment.questions || []).filter((q) => q.category === 'coding') : [];

  const techCount = isTechEnabled ? (assessment.techCount ?? 5) : 0;
  const codingCount = isCodingEnabled ? (assessment.codingCount ?? 2) : 0;

  const shuffledTech = shuffleWithSeed(techQuestions, token + '_tech');
  const shuffledCoding = shuffleWithSeed(codingQuestions, token + '_coding');

  const selectedTech = shuffledTech.slice(0, Math.min(techCount, shuffledTech.length));
  const selectedCoding = shuffledCoding.slice(0, Math.min(codingCount, shuffledCoding.length));

  const questionsList = [...selectedTech, ...selectedCoding];
  const customizedAssessment = {
    ...assessment,
    questions: questionsList.length > 0 ? questionsList : (assessment.questions || [])
  };

  res.json({ candidate, assessment: customizedAssessment });
});

// Start Candidate Test
interviewRouter.post('/:token/start', (req, res) => {
  const { token } = req.params;
  const db = getDb();
  const candIndex = db.candidates.findIndex((c) => c.token === token);
  if (candIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  db.candidates[candIndex].status = 'In Progress';
  db.candidates[candIndex].startedAt = new Date().toISOString();
  saveDb(db);
  res.json(db.candidates[candIndex]);
});

// AI Clarify Question / Provide conceptual hint
interviewRouter.post('/:token/clarify-question', async (req, res) => {
  const { questionText, category } = req.body;

  const ai = getGeminiClient();
  let clarificationText = "I am looking to understand your high-level conceptual approach or design options for this scenario. Could you share your thoughts on the general solution?";
  let speechText = "Sure! I would be glad to help clarify. I am interested in understanding your high-level engineering approach or how you model this scenario. Could you share your general thoughts?";

  if (ai || isGroqConfigured()) {
    try {
      const promptText = `
Candidate is sitting for an interview and finds this question hard to understand or needs some guidance.
Provide a clear, simple clarification/hint to help guide them.

Question Category: ${category}
Question Text: ${questionText}

Instructions for Clarification:
1. Rephrase or explain what the question actually means in plain, simpler terms.
2. Provide a helpful conceptual angle, tip, or starting point to think about.
3. CRITICAL LIMITATION: You MUST NOT provide the correct answer, complete solution, or any source code. Give them an idea or guidance, but never the answer.
4. Respond strictly in English in JSON format with properties:
- "clarification": A maximum 2-sentence simpler explanation and conceptual hint.
- "speech": A friendly, warm spoken message saying something like "Of course! Let me help you with that. In this question, we want to know..." (incorporating the simplified explanation naturally).
`;

      const response = await generateContentWithFallback(ai, {
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clarification: { type: Type.STRING },
              speech: { type: Type.STRING }
            },
            required: ['clarification', 'speech']
          }
        }
      });

      const parsed = cleanAndParseJSON(response.text);
      clarificationText = parsed.clarification ?? clarificationText;
      speechText = parsed.speech ?? speechText;
    } catch (err) {
      console.error('[GEMINI CLARIFICATION ERROR]', err);
    }
  }

  res.json({ clarification: clarificationText, speech: speechText });
});

// AI Evaluate Single Interview Answer & Draft speech reaction
interviewRouter.post('/:token/evaluate-answer', async (req, res) => {
  const { token } = req.params;
  const { questionId, candidateAnswer, questionText, category, isCrossAnswer } = req.body;

  let responseMessage = 'Got it. Thank you for your response. Let us proceed to the next query.';
  let outCrossQuestionText = '';
  let hasCrossQuestion = false;

  const db = getDb();
  const candIndex = db.candidates.findIndex((c) => c.token === token);
  const candidateAnswerStr = candidateAnswer || '';

  const naturalFillers = [
    "Got it, thank you.",
    "Noted, thanks for explaining.",
    "Understood, thank you.",
    "Great, thank you.",
    "Sounds good, thanks for that answer."
  ];

  const currentCount = candIndex !== -1 ? (db.candidates[candIndex]?.feedbackReport?.transcripts?.length || 0) : 0;
  const selectedFiller = naturalFillers[currentCount % naturalFillers.length];

  // Special handling for the initial self-introduction question
  if (category === 'intro' || questionId === 'intro-q1') {
    responseMessage = "Okay, great to know! Now we can move ahead with your technical evaluation.";
    hasCrossQuestion = false;

    if (candIndex !== -1) {
      const cand = db.candidates[candIndex];
      if (!cand.feedbackReport) {
        cand.feedbackReport = {
          decision: 'Review Pending',
          summary: 'Review Pending: Suri is compiling comprehensive technical feedback asynchronously.',
          technicalScore: 0,
          communicationScore: 0,
          problemSolvingScore: 0,
          cheatingRisk: 'Low',
          cheatingLogs: [],
          transcripts: []
        };
      }
      if (!cand.feedbackReport.transcripts) {
        cand.feedbackReport.transcripts = [];
      }

      const existingIdx = cand.feedbackReport.transcripts.findIndex((t: any) => t.questionId === questionId);
      const introTranscript = {
        questionId: questionId || 'intro-q1',
        category: 'intro' as const,
        questionText: questionText || 'Please give an introduction about yourself with your total experience, your technical journey till now, some of the key highlights of your projects and tech stack.',
        candidateAnswer: candidateAnswerStr,
        aiEvaluation: 'Candidate introduction and background summary recorded. Exempt from technical grading.',
        score: 0,
        crossQuestionText: '',
        crossAnswerText: '',
        crossAiEvaluation: ''
      };

      if (existingIdx !== -1) {
        cand.feedbackReport.transcripts[existingIdx] = introTranscript;
      } else {
        cand.feedbackReport.transcripts.push(introTranscript);
      }
      saveDb(db);
    }

    return res.json({
      score: 0,
      aiEvaluation: 'Candidate introduction recorded (exempt from score)',
      responseMessage,
      hasCrossQuestion: false,
      crossQuestionText: ''
    });
  }

  // Phase 1: Primary Answer Evaluation & Conversational Transition
  if (!isCrossAnswer) {
    hasCrossQuestion = false;
    outCrossQuestionText = '';
    responseMessage = selectedFiller;

    if (candIndex !== -1) {
      const cand = db.candidates[candIndex];
      if (!cand.feedbackReport) {
        cand.feedbackReport = {
          decision: 'Review Pending',
          summary: 'Review Pending: Suri is compiling comprehensive technical feedback asynchronously.',
          technicalScore: 0,
          communicationScore: 0,
          problemSolvingScore: 0,
          cheatingRisk: 'Low',
          cheatingLogs: [],
          transcripts: []
        };
      }
      if (!cand.feedbackReport.transcripts) {
        cand.feedbackReport.transcripts = [];
      }

      const existingIdx = cand.feedbackReport.transcripts.findIndex((t: any) => t.questionId === questionId);
      const newTranscript = {
        questionId,
        category: (category as any) || 'tech',
        questionText,
        candidateAnswer: candidateAnswerStr,
        aiEvaluation: 'Pending final evaluation',
        score: 0,
        crossQuestionText: outCrossQuestionText,
        crossAnswerText: '',
        crossAiEvaluation: ''
      };

      if (existingIdx !== -1) {
        cand.feedbackReport.transcripts[existingIdx] = newTranscript;
      } else {
        cand.feedbackReport.transcripts.push(newTranscript);
      }
      saveDb(db);
    }

    return res.json({
      score: 0,
      aiEvaluation: 'Pending final evaluation',
      responseMessage,
      hasCrossQuestion,
      crossQuestionText: outCrossQuestionText
    });
  } else {
    // Phase 2: Follow-up Cross-Answer Transition
    responseMessage = selectedFiller;

    if (candIndex !== -1) {
      const cand = db.candidates[candIndex];
      if (cand.feedbackReport?.transcripts) {
        const existingIdx = cand.feedbackReport.transcripts.findIndex((t: any) => t.questionId === questionId);
        if (existingIdx !== -1) {
          const t = cand.feedbackReport.transcripts[existingIdx];
          t.crossAnswerText = candidateAnswerStr;
          t.crossAiEvaluation = 'Pending final evaluation';
          t.aiEvaluation = `${t.aiEvaluation} | Follow-up: Pending final evaluation`;
          t.score = 0;
        }
      }

      const assessment = db.assessments.find((a) => a.id === cand.assessmentId);
      let totalQ = 10;
      if (assessment) {
        const isTechEnabled = assessment.roundsEnabled?.tech !== false;
        const isCodingEnabled = assessment.roundsEnabled?.coding !== false;
        const techCount = isTechEnabled ? (assessment.techCount ?? 5) : 0;
        const codingCount = isCodingEnabled ? (assessment.codingCount ?? 2) : 0;
        const techQuestionsLength = isTechEnabled ? assessment.questions.filter((q) => q.category === 'tech').length : 0;
        const codingQuestionsLength = isCodingEnabled ? assessment.questions.filter((q) => q.category === 'coding').length : 0;
        totalQ = Math.min(techCount, techQuestionsLength) + Math.min(codingCount, codingQuestionsLength);
      }
      const answeredQ = cand.feedbackReport?.transcripts.length || 0;
      
      if (answeredQ > 0 && answeredQ < totalQ) {
        cand.status = 'Pending and Incomplete';
      } else if (answeredQ === totalQ) {
        cand.status = 'Completed';
      }
      saveDb(db);
    }

    return res.json({ score: 0, aiEvaluation: 'Pending final evaluation', responseMessage });
  }
});

// Finalize Candidate Interview & Delegate to Single Evaluation Pipeline
interviewRouter.post('/:token/complete', async (req, res) => {
  const { token } = req.params;
  const { transcripts, proctoringSummary, isSuspended, clientCheatingLogs } = req.body || {};

  const result = finalizeInterviewEvaluation({
    candidateToken: token,
    clientTranscripts: Array.isArray(transcripts) ? transcripts : undefined,
    proctoringSummary,
    isSuspended: Boolean(isSuspended),
    clientCheatingLogs: Array.isArray(clientCheatingLogs) ? clientCheatingLogs : undefined,
    queueAiAsync: true
  });

  if (!result) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  const { candidate, assessment } = result;
  const startLink = `${process.env.APP_URL || 'http://localhost:3000'}/?token=${candidate.token}`;
  sendCandidateEmail(candidate.email, candidate.name, 'COMPLETED', {
    assessmentTitle: assessment?.title,
    startLink
  }).catch((err) => console.error('Async candidate completed email dispatch error:', err));

  res.json(candidate);
});

// Upload Video/Audio Recording Asset
interviewRouter.post('/:token/upload-recording', upload.single('recording'), async (req, res) => {
  const { token } = req.params;
  const { duration } = req.body;
  const db = getDb();
  
  const candIndex = db.candidates.findIndex((c) => c.token === token);
  if (candIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  const candidate = db.candidates[candIndex];
  if (!req.file) {
    return res.status(400).json({ error: 'No recording file uploaded.' });
  }

  const fileName = req.file.filename;
  const filePath = req.file.path;

  let finalUrl = `/recordings/${fileName}`;
  const r2Url = await uploadToR2(filePath, fileName);
  if (r2Url) {
    finalUrl = r2Url;
  }

  candidate.recordingUrl = finalUrl;
  if (duration) {
    candidate.recordingDuration = parseFloat(duration);
  }

  db.candidates[candIndex] = candidate;
  saveDb(db);

  res.json({
    success: true,
    recordingUrl: finalUrl,
    recordingDuration: candidate.recordingDuration
  });
});

// Execute Candidate Code in Sandbox (token/session authorized, size-capped, rate-limited)
interviewRouter.post('/:token/execute-code', codeExecutionLimiter, async (req, res) => {
  const { token } = req.params;
  const { code, language = 'javascript' } = req.body;

  // 1. Verify active candidate interview token OR authenticated Recruiter/Admin demo session
  if (token === 'demo' || token === 'demo-test-token') {
    const authUser = tryAuthenticateRequest(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Demo code execution requires an authenticated Recruiter or Admin session.' });
    }
  } else {
    const db = getDb();
    const candidate = (db.candidates || []).find((c) => c.token === token);
    if (!candidate) {
      return res.status(401).json({ error: 'Invalid or unauthorized interview session token.' });
    }

    if (candidate.status === 'Completed' || candidate.status === 'Suspended') {
      return res.status(403).json({ error: 'Code execution is disabled because this interview session is closed.' });
    }

    const asmt = (db.assessments || []).find((a) => a.id === candidate.assessmentId);
    if (asmt && asmt.status === 'Closed') {
      return res.status(403).json({ error: 'Code execution is disabled because this assessment has been closed.' });
    }
  }

  // 2. Validate code payload & size cap
  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Code content is required.' });
  }

  if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES) {
    return res.status(413).json({
      error: `Code payload exceeds the ${Math.floor(MAX_CODE_BYTES / 1000)} KB execution limit.`
    });
  }

  // 3. Validate supported runtime language
  if (!resolveSupportedLanguage(String(language))) {
    return res.status(400).json({ error: `Unsupported programming language: "${language}".` });
  }

  try {
    const data = await executeCodeSandbox(code, String(language));
    res.json(data);
  } catch (error: any) {
    console.error('[CODE_EXECUTION_ERROR]', error?.message || error);
    res.status(502).json({
      error: 'External code execution sandbox failed',
      details: error?.message || 'Execution timeout or upstream error'
    });
  }
});
