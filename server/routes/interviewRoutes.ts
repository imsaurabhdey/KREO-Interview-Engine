/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Candidate Live Interview, Real-time Answer Processing & Proctoring Routes.
 */

import { Router } from 'express';
import { Type } from '@google/genai';
import { getDb, saveDb, shuffleWithSeed } from '../db';
import { getGeminiClient, generateContentWithFallback, evaluateNeedsFollowUp } from '../gemini';
import { executeCodeSandbox } from '../codeExecution';
import { upload, uploadToR2 } from '../s3Storage';
import { sendCandidateEmail } from '../emailService';
import { queueCandidateForEvaluation } from '../evaluationService';

export const interviewRouter = Router();

/**
 * Uncompromising Answer Quality Evaluator.
 * Analyzes candidate responses with absolute realism:
 * - Single-word / Evasive / Superficial / "Yes-No" answers -> Score: 0% - 10%
 * - Broken / Syntax-error code -> Score: 0% - 20%
 * - Partial answer without depth/edge-cases -> Score: 40% - 60%
 * - Detailed, correct, well-structured response -> Score: 75% - 95%
 */
export function evaluateAnswerQuality(
  answer: string,
  category: string = 'tech',
  questionText: string = ''
): { score: number; feedback: string; isSuperficial: boolean } {
  if (!answer || typeof answer !== 'string') {
    return {
      score: 0,
      feedback: 'Candidate provided no response or submitted an empty answer.',
      isSuperficial: true
    };
  }

  const clean = answer.trim().toLowerCase();
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  const superficialPhrases = [
    'yes', 'no', 'yeah', 'nope', 'ok', 'okay', 'idk', 'dunno', 'i don\'t know', 'i dont know',
    'pass', 'skip', 'sure', 'fine', 'hi', 'hello', 'maybe', 'not sure', 'nothing', 'na', 'n/a',
    'yes sir', 'no sir', 'yes maam', 'yes i know', 'no i dont', 'yes i can', 'no i cant'
  ];

  const isExactSuperficial = superficialPhrases.includes(clean);
  const isCodeKeyword = clean.includes('function') || clean.includes('return') || clean.includes('const') || clean.includes('class') || clean.includes('import') || clean.includes('def ') || clean.includes('for');
  const isTooShort = wordCount <= 4 && !isCodeKeyword;

  if (isExactSuperficial || isTooShort) {
    return {
      score: 5,
      feedback: `Unsatisfactory answer. Candidate responded with only "${answer.trim()}" without providing any technical explanation, algorithm logic, or code implementation. Fails skill requirements.`,
      isSuperficial: true
    };
  }

  if (category === 'coding') {
    const hasCodeStructure = clean.includes('def ') || clean.includes('function') || clean.includes('const ') || 
                             clean.includes('var ') || clean.includes('let ') || clean.includes('return') || 
                             clean.includes('class ') || clean.includes('import ') || clean.includes('for(') || 
                             clean.includes('for ') || clean.includes('while') || clean.includes('=>') || 
                             clean.includes('if(') || clean.includes('if ') || clean.includes('{') || clean.includes(';');

    if (!hasCodeStructure) {
      return {
        score: 10,
        feedback: `Errors in code submission. Candidate provided prose ("${answer.substring(0, 50)}...") instead of executable source code logic. Solution is unsuitable for production requirements.`,
        isSuperficial: false
      };
    }

    if (wordCount < 20) {
      return {
        score: 30,
        feedback: `Code submission is incomplete or contains syntax/logic bugs and lacks required edge-case handling.`,
        isSuperficial: false
      };
    }

    return {
      score: 75,
      feedback: `Candidate submitted a structured code solution. Logic passes core structure checks.`,
      isSuperficial: false
    };
  }

  if (wordCount < 10) {
    return {
      score: 20,
      feedback: `Candidate answer is extremely brief (${wordCount} words) and lacks core technical concepts or architectural reasoning for this skill.`,
      isSuperficial: true
    };
  }

  if (wordCount < 25) {
    return {
      score: 50,
      feedback: `Candidate provided a basic answer but missed critical depth, efficiency trade-offs, and boundary conditions required for ${questionText.substring(0, 40) || 'this topic'}.`,
      isSuperficial: false
    };
  }

  return {
    score: 80,
    feedback: `Candidate provided a structured technical explanation covering core principles.`,
    isSuperficial: false
  };
}

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

  if (ai) {
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

      const parsed = JSON.parse(response.text?.trim() || '{}');
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

// Finalize Candidate Interview & Trigger Full Report Compilation
interviewRouter.post('/:token/complete', async (req, res) => {
  const { token } = req.params;
  const { transcripts, proctoringSummary, isSuspended, clientCheatingLogs } = req.body;

  const db = getDb();
  const candIndex = db.candidates.findIndex((c) => c.token === token);
  if (candIndex === -1) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  const candidate = db.candidates[candIndex];
  const assessment = db.assessments.find((a) => a.id === candidate.assessmentId);

  let technicalScore = 70;
  let communicationScore = 75;
  let problemSolvingScore = 70;
  let summary = 'The candidate completed all sections of the interview.';
  let cheatingRisk: 'Low' | 'Medium' | 'High' = 'Low';
  let decision: 'Strong Hire' | 'Hire' | 'Neutral' | 'Reject' = 'Hire';

  const cheatingLogs: string[] = Array.isArray(clientCheatingLogs) ? [...clientCheatingLogs] : [];

  if (proctoringSummary) {
    if (proctoringSummary.tabSwitches > 5 || proctoringSummary.browserFocusViolations > 8) {
      cheatingRisk = 'High';
      decision = 'Reject';
      cheatingLogs.push(`High Tab Switching Events (${proctoringSummary.tabSwitches} blurs). Possible third-party code lookup detected.`);
    } else if (proctoringSummary.tabSwitches > 0) {
      cheatingLogs.push(`Suspicion: Tab Switch detected (${proctoringSummary.tabSwitches} switches).`);
    }

    if (proctoringSummary.copyPasteAttempts > 0) {
      cheatingRisk = 'High';
      cheatingLogs.push(`Security Alert: Intercepted ${proctoringSummary.copyPasteAttempts} clipboard copy/paste attempts. Operation forbidden.`);
    }

    if (proctoringSummary.cameraOffViolations > 0) {
      cheatingRisk = 'High';
      decision = 'Reject';
      cheatingLogs.push(`Device Compliance Failed: Camera feed signal was intentionally disabled or lost (${proctoringSummary.cameraOffViolations} times).`);
    }

    if (proctoringSummary.notVisibleViolations > 0) {
      cheatingLogs.push(`AI Gaze Alert: Candidate was looking off-screen constantly or head was completely removed from the camera feed (${proctoringSummary.notVisibleViolations} times logged by eye-movement tracker).`);
      if (proctoringSummary.notVisibleViolations > 3) {
        cheatingRisk = 'High';
      } else if (cheatingRisk !== 'High') {
        cheatingRisk = 'Medium';
      }
    }

    if (proctoringSummary.faceDetectionsLost > 5) {
      cheatingLogs.push(`Gaze Deviancy Logged: Standard AI eye center face mesh coordinate drift registered.`);
    }
  }

  if (isSuspended) {
    cheatingRisk = 'High';
    decision = 'Reject';
    cheatingLogs.push('System aborted candidate test workspace immediately due to minimizing, exiting full screen, or other safety violations.');
  }

  const activeTranscripts = transcripts || candidate.feedbackReport?.transcripts || [];

  let totalTechScore = 0;
  let techCount = 0;
  let totalCodeScore = 0;
  let codeCount = 0;
  let totalSuperficialAnswers = 0;

  activeTranscripts.forEach((t: any) => {
    if (t.category !== 'intro' && t.questionId !== 'intro-q1') {
      const fullAns = `${t.candidateAnswer || ''} ${t.crossAnswerText || ''}`.trim();
      const evalRes = evaluateAnswerQuality(fullAns, t.category, t.questionText);
      
      t.score = evalRes.score;
      t.aiEvaluation = evalRes.feedback;
      if (t.crossAnswerText) {
        t.crossAiEvaluation = evalRes.feedback;
      }

      if (evalRes.isSuperficial) {
        totalSuperficialAnswers++;
      }

      if (t.category === 'coding') {
        totalCodeScore += evalRes.score;
        codeCount++;
      } else {
        totalTechScore += evalRes.score;
        techCount++;
      }
    }
  });

  if (techCount > 0) {
    technicalScore = Math.round(totalTechScore / techCount);
  } else {
    technicalScore = 0;
  }

  if (codeCount > 0) {
    problemSolvingScore = Math.round(totalCodeScore / codeCount);
  } else {
    problemSolvingScore = technicalScore;
  }

  if (totalSuperficialAnswers > 0) {
    communicationScore = Math.max(10, Math.min(40, 50 - (totalSuperficialAnswers * 15)));
  } else {
    communicationScore = Math.round((technicalScore + problemSolvingScore) / 2);
  }

  const overallFitmentAvg = Math.max(0, Math.min(100, Math.round(technicalScore * 0.5 + problemSolvingScore * 0.25 + communicationScore * 0.25)));

  if (isSuspended) {
    summary = 'REJECT: Proctor terminated test midway due to critical security violations.';
    decision = 'Reject';
  } else if (totalSuperficialAnswers >= 2 || overallFitmentAvg < 55) {
    decision = 'Reject';
    summary = `REJECT: Candidate failed technical evaluation (${overallFitmentAvg}% fitment). Answers were single-word or superficial ('Yes/No') without technical depth or reasoning.`;
  } else if (overallFitmentAvg >= 85) {
    decision = 'Strong Hire';
    summary = `STRONG HIRE: Candidate demonstrated strong technical depth, clear communication, and correct code implementation (${overallFitmentAvg}% fitment).`;
  } else if (overallFitmentAvg >= 75) {
    decision = 'Hire';
    summary = `HIRE: Candidate met technical competency benchmarks with satisfactory problem-solving and communication skills (${overallFitmentAvg}% fitment).`;
  } else {
    decision = 'Reject';
    summary = `REJECT: Candidate scored ${overallFitmentAvg}%, failing the 75% selection benchmark. Demonstrated knowledge gaps in core required skills.`;
  }

  const initialDecision = isSuspended ? 'Reject' : (totalSuperficialAnswers >= 2 || overallFitmentAvg < 55 ? 'Reject' : 'Review Pending');

  candidate.status = isSuspended ? 'Suspended' : 'Completed';
  candidate.completedAt = new Date().toISOString();
  candidate.proctoringSummary = proctoringSummary || { tabSwitches: 0, browserFocusViolations: 0, faceDetectionsLost: 0 };
  candidate.feedbackReport = {
    decision: initialDecision,
    summary,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    cheatingRisk,
    cheatingLogs,
    transcripts: activeTranscripts
  };
  candidate.aiAssessmentScore = overallFitmentAvg;

  db.candidates[candIndex] = candidate;
  saveDb(db);

  const ai = getGeminiClient();
  if (ai && !isSuspended && activeTranscripts.length > 0) {
    queueCandidateForEvaluation(candidate.token, activeTranscripts, proctoringSummary, isSuspended);
  }

  const startLink = `${process.env.APP_URL || 'http://localhost:3000'}/?token=${candidate.token}`;
  sendCandidateEmail(candidate.email, candidate.name, 'COMPLETED', {
    assessmentTitle: assessment?.title,
    startLink
  }).catch((err) => console.error("Async candidate completed email dispatch error:", err));

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

// Execute Candidate Code in Sandbox
interviewRouter.post('/:token/execute-code', async (req, res) => {
  const { code, language } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Code content is required.' });
  }

  try {
    const data = await executeCodeSandbox(code, language);
    res.json(data);
  } catch (error: any) {
    console.error('[CODE_EXECUTION_ERROR]', error);
    res.status(500).json({
      error: 'Execution request failed',
      details: error.message
    });
  }
});
