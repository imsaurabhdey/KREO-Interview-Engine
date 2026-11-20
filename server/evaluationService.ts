/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single Source of Truth for Interview Evaluation, Proctoring Compliance,
 * Deterministic Baseline Scoring, and Retrospective AI Evaluation Queue.
 */

import { Type } from '@google/genai';
import { getDb, saveDb } from './db';
import { getGeminiClient, generateContentWithFallback, cleanAndParseJSON, isGroqConfigured } from './gemini';
import type {
  Assessment,
  Candidate,
  EvaluationHistoryEntry,
  EvaluationReport,
  ProctoringSummary,
  TranscriptEntry
} from '../src/types';

export type FinalDecision = 'Strong Hire' | 'Hire' | 'Neutral' | 'Reject';
export type ReportDecision = FinalDecision | 'Review Pending';

export interface EvaluationJob {
  candidateToken: string;
  transcripts: TranscriptEntry[];
  proctoringSummary: ProctoringSummary;
  isSuspended: boolean;
  hasCriticalComplianceViolation: boolean;
}

export interface ProctoringAssessmentResult {
  cheatingRisk: 'Low' | 'Medium' | 'High';
  cheatingLogs: string[];
  hasCriticalComplianceViolation: boolean;
}

export interface FinalizeInterviewInput {
  candidateToken: string;
  clientTranscripts?: TranscriptEntry[];
  proctoringSummary?: Partial<ProctoringSummary>;
  isSuspended?: boolean;
  clientCheatingLogs?: string[];
  queueAiAsync?: boolean;
}

export interface FinalizeInterviewResult {
  candidate: Candidate;
  assessment?: Assessment;
  queuedAiEvaluation: boolean;
  alreadyFinalized?: boolean;
}

const VALID_AI_DECISIONS: ReadonlySet<string> = new Set(['Strong Hire', 'Hire', 'Neutral', 'Reject']);

const evaluationQueue: EvaluationJob[] = [];
let isProcessingQueue = false;

/**
 * Single composite fitment formula shared across baseline and AI evaluation paths.
 */
export function computeCompositeScore(
  technicalScore: number,
  problemSolvingScore: number,
  communicationScore: number
): number {
  const safeTech = Number.isFinite(technicalScore) ? Math.max(0, Math.min(100, technicalScore)) : 0;
  const safeProblem = Number.isFinite(problemSolvingScore) ? Math.max(0, Math.min(100, problemSolvingScore)) : 0;
  const safeComm = Number.isFinite(communicationScore) ? Math.max(0, Math.min(100, communicationScore)) : 0;
  return Math.max(0, Math.min(100, Math.round(safeTech * 0.5 + safeProblem * 0.25 + safeComm * 0.25)));
}

/**
 * Single verdict derivation rule shared across all evaluation stages.
 */
export function deriveDecisionFromScore(
  overallScore: number,
  options: {
    isSuspended?: boolean;
    hasCriticalComplianceViolation?: boolean;
    superficialCount?: number;
  } = {}
): FinalDecision {
  if (options.isSuspended || options.hasCriticalComplianceViolation) {
    return 'Reject';
  }
  if ((options.superficialCount ?? 0) >= 2 || overallScore < 55) {
    return 'Reject';
  }
  if (overallScore >= 85) {
    return 'Strong Hire';
  }
  if (overallScore >= 75) {
    return 'Hire';
  }
  return 'Neutral';
}

/**
 * Normalizes proctoring counters and derives authoritative compliance risk & violation logs.
 */
export function assessProctoringCompliance(
  rawSummary?: Partial<ProctoringSummary>,
  isSuspended: boolean = false,
  clientCheatingLogs?: string[]
): { normalizedSummary: ProctoringSummary } & ProctoringAssessmentResult {
  const normalizedSummary: ProctoringSummary = {
    tabSwitches: Number(rawSummary?.tabSwitches ?? 0),
    browserFocusViolations: Number(rawSummary?.browserFocusViolations ?? 0),
    faceDetectionsLost: Number(rawSummary?.faceDetectionsLost ?? 0),
    copyPasteAttempts: Number(rawSummary?.copyPasteAttempts ?? 0),
    cameraOffViolations: Number(rawSummary?.cameraOffViolations ?? 0),
    notVisibleViolations: Number(rawSummary?.notVisibleViolations ?? 0),
    audioDetectedViolations: Number(rawSummary?.audioDetectedViolations ?? 0),
    multiplePeopleViolations: Number(rawSummary?.multiplePeopleViolations ?? 0),
    phoneViolations: Number(rawSummary?.phoneViolations ?? 0),
    exitFullscreenCount: Number(rawSummary?.exitFullscreenCount ?? 0)
  };

  let cheatingRisk: 'Low' | 'Medium' | 'High' = 'Low';
  let hasCriticalComplianceViolation = Boolean(isSuspended);
  const cheatingLogs: string[] = Array.isArray(clientCheatingLogs)
    ? clientCheatingLogs.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

  if (normalizedSummary.tabSwitches > 5 || normalizedSummary.browserFocusViolations > 8) {
    cheatingRisk = 'High';
    hasCriticalComplianceViolation = true;
    cheatingLogs.push(
      `High Tab Switching Events (${normalizedSummary.tabSwitches} blurs). Possible third-party code lookup detected.`
    );
  } else if (normalizedSummary.tabSwitches > 0) {
    cheatingLogs.push(`Suspicion: Tab Switch detected (${normalizedSummary.tabSwitches} switches).`);
  }

  if ((normalizedSummary.copyPasteAttempts ?? 0) > 0) {
    cheatingRisk = 'High';
    cheatingLogs.push(
      `Security Alert: Intercepted ${normalizedSummary.copyPasteAttempts} clipboard copy/paste attempts. Operation forbidden.`
    );
  }

  if ((normalizedSummary.cameraOffViolations ?? 0) > 0) {
    cheatingRisk = 'High';
    hasCriticalComplianceViolation = true;
    cheatingLogs.push(
      `Device Compliance Failed: Camera feed signal was intentionally disabled or lost (${normalizedSummary.cameraOffViolations} times).`
    );
  }

  if ((normalizedSummary.notVisibleViolations ?? 0) > 0) {
    cheatingLogs.push(
      `AI Gaze Alert: Candidate was looking off-screen constantly or head was completely removed from the camera feed (${normalizedSummary.notVisibleViolations} times logged by eye-movement tracker).`
    );
    if ((normalizedSummary.notVisibleViolations ?? 0) > 3) {
      cheatingRisk = 'High';
    } else if (cheatingRisk !== 'High') {
      cheatingRisk = 'Medium';
    }
  }

  if (normalizedSummary.faceDetectionsLost > 5) {
    cheatingLogs.push('Gaze Deviancy Logged: Standard AI eye center face mesh coordinate drift registered.');
  }

  if (isSuspended) {
    cheatingRisk = 'High';
    hasCriticalComplianceViolation = true;
    cheatingLogs.push(
      'System aborted candidate test workspace immediately due to minimizing, exiting full screen, or other safety violations.'
    );
  }

  return {
    normalizedSummary,
    cheatingRisk,
    cheatingLogs: Array.from(new Set(cheatingLogs)),
    hasCriticalComplianceViolation
  };
}

/**
 * Uncompromising Answer Quality Evaluator (deterministic baseline rubric).
 * - Single-word / Evasive / Superficial / "Yes-No" answers -> Score: 0% - 10%
 * - Broken / Prose-only code -> Score: 10% - 30%
 * - Partial answer without depth/edge-cases -> Score: 50%
 * - Detailed, structured response -> Score: 75% - 80%
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
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const superficialPhrases = [
    'yes', 'no', 'yeah', 'nope', 'ok', 'okay', 'idk', 'dunno', "i don't know", 'i dont know',
    'pass', 'skip', 'sure', 'fine', 'hi', 'hello', 'maybe', 'not sure', 'nothing', 'na', 'n/a',
    'yes sir', 'no sir', 'yes maam', 'yes i know', 'no i dont', 'yes i can', 'no i cant'
  ];

  const isExactSuperficial = superficialPhrases.includes(clean);
  const isCodeKeyword =
    clean.includes('function') ||
    clean.includes('return') ||
    clean.includes('const') ||
    clean.includes('class') ||
    clean.includes('import') ||
    clean.includes('def ') ||
    clean.includes('for');
  const isTooShort = wordCount <= 4 && !isCodeKeyword;

  if (isExactSuperficial || isTooShort) {
    return {
      score: 5,
      feedback: `Unsatisfactory answer. Candidate responded with only "${answer.trim()}" without providing any technical explanation, algorithm logic, or code implementation. Fails skill requirements.`,
      isSuperficial: true
    };
  }

  if (category === 'coding') {
    const hasCodeStructure =
      clean.includes('def ') ||
      clean.includes('function') ||
      clean.includes('const ') ||
      clean.includes('var ') ||
      clean.includes('let ') ||
      clean.includes('return') ||
      clean.includes('class ') ||
      clean.includes('import ') ||
      clean.includes('for(') ||
      clean.includes('for ') ||
      clean.includes('while') ||
      clean.includes('=>') ||
      clean.includes('if(') ||
      clean.includes('if ') ||
      clean.includes('{') ||
      clean.includes(';');

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
        feedback: 'Code submission is incomplete or contains syntax/logic bugs and lacks required edge-case handling.',
        isSuperficial: false
      };
    }

    return {
      score: 75,
      feedback: 'Candidate submitted a structured code solution. Logic passes core structure checks.',
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
    feedback: 'Candidate provided a structured technical explanation covering core principles.',
    isSuperficial: false
  };
}

/**
 * Merges server-persisted transcripts (recorded during /evaluate-answer) with final submission payload.
 * Server-recorded answers take precedence when non-empty so browser tampering cannot rewrite prior answers.
 */
export function mergeAuthoritativeTranscripts(
  serverTranscripts: TranscriptEntry[] | undefined,
  clientTranscripts: TranscriptEntry[] | undefined
): TranscriptEntry[] {
  const serverList = Array.isArray(serverTranscripts) ? serverTranscripts : [];
  const clientList = Array.isArray(clientTranscripts) ? clientTranscripts : [];

  if (serverList.length === 0) {
    return clientList.map((entry) => ({ ...entry }));
  }

  const mergedById = new Map<string, TranscriptEntry>();
  for (const s of serverList) {
    mergedById.set(s.questionId, { ...s });
  }

  for (const c of clientList) {
    const existing = mergedById.get(c.questionId);
    if (!existing) {
      mergedById.set(c.questionId, { ...c });
    } else {
      // Keep server-persisted answer when present; fill in missing answer/cross-answer only if server copy was blank.
      if (!existing.candidateAnswer?.trim() && c.candidateAnswer?.trim()) {
        existing.candidateAnswer = c.candidateAnswer;
      }
      if (!existing.crossAnswerText?.trim() && c.crossAnswerText?.trim()) {
        existing.crossAnswerText = c.crossAnswerText;
      }
      if (!existing.crossQuestionText?.trim() && c.crossQuestionText?.trim()) {
        existing.crossQuestionText = c.crossQuestionText;
      }
      if (!existing.codeExecutionOutput?.trim() && c.codeExecutionOutput?.trim()) {
        existing.codeExecutionOutput = c.codeExecutionOutput;
      }
      if (!existing.codeLanguage?.trim() && c.codeLanguage?.trim()) {
        existing.codeLanguage = c.codeLanguage;
      }
    }
  }

  return Array.from(mergedById.values());
}

/**
 * Single authoritative entry point called when a candidate finishes or is suspended from an interview.
 * Computes the deterministic baseline report, records an auditable history transition, saves to DB,
 * and schedules retrospective AI evaluation when eligible.
 */
export function finalizeInterviewEvaluation(input: FinalizeInterviewInput): FinalizeInterviewResult | null {
  const {
    candidateToken,
    clientTranscripts,
    proctoringSummary,
    isSuspended = false,
    clientCheatingLogs,
    queueAiAsync = true
  } = input;

  const db = getDb();
  const candIndex = db.candidates.findIndex((c) => c.token === candidateToken);
  if (candIndex === -1) {
    return null;
  }

  const candidate = db.candidates[candIndex];
  const assessment = db.assessments.find((a) => a.id === candidate.assessmentId);

  // Lock finalized interviews so completed or suspended reports cannot be overwritten by re-submission
  if (candidate.status === 'Completed' || candidate.status === 'Suspended') {
    return {
      candidate,
      assessment,
      queuedAiEvaluation: false,
      alreadyFinalized: true
    };
  }

  const compliance = assessProctoringCompliance(proctoringSummary, isSuspended, clientCheatingLogs);
  const activeTranscripts = mergeAuthoritativeTranscripts(candidate.feedbackReport?.transcripts, clientTranscripts);

  let totalTechScore = 0;
  let techCount = 0;
  let totalCodeScore = 0;
  let codeCount = 0;
  let totalSuperficialAnswers = 0;

  const evaluatedTranscripts: TranscriptEntry[] = activeTranscripts.map((entry) => {
    const copy: TranscriptEntry = { ...entry };
    if (copy.category === 'intro' || copy.questionId === 'intro-q1') {
      return copy;
    }

    const fullAns = `${copy.candidateAnswer || ''} ${copy.crossAnswerText || ''}`.trim();
    const evalRes = evaluateAnswerQuality(fullAns, copy.category, copy.questionText);
    copy.score = evalRes.score;
    copy.aiEvaluation = evalRes.feedback;
    if (copy.crossAnswerText) {
      copy.crossAiEvaluation = evalRes.feedback;
    }

    if (evalRes.isSuperficial) {
      totalSuperficialAnswers++;
    }

    if (copy.category === 'coding') {
      totalCodeScore += evalRes.score;
      codeCount++;
    } else {
      totalTechScore += evalRes.score;
      techCount++;
    }
    return copy;
  });

  const technicalScore = techCount > 0 ? Math.round(totalTechScore / techCount) : 0;
  const problemSolvingScore = codeCount > 0 ? Math.round(totalCodeScore / codeCount) : technicalScore;
  const communicationScore =
    totalSuperficialAnswers > 0
      ? Math.max(10, Math.min(40, 50 - totalSuperficialAnswers * 15))
      : Math.round((technicalScore + problemSolvingScore) / 2);

  const overallFitmentAvg = computeCompositeScore(technicalScore, problemSolvingScore, communicationScore);

  const baselineDecision = deriveDecisionFromScore(overallFitmentAvg, {
    isSuspended,
    hasCriticalComplianceViolation: compliance.hasCriticalComplianceViolation,
    superficialCount: totalSuperficialAnswers
  });

  let summary: string;
  if (isSuspended) {
    summary = 'REJECT: Proctor terminated test midway due to critical security violations.';
  } else if (compliance.hasCriticalComplianceViolation) {
    summary = `REJECT: Candidate failed proctoring compliance controls (${overallFitmentAvg}% technical baseline). Critical integrity violations were recorded.`;
  } else if (totalSuperficialAnswers >= 2 || overallFitmentAvg < 55) {
    summary = `REJECT: Candidate failed technical evaluation (${overallFitmentAvg}% fitment). Answers were single-word or superficial ('Yes/No') without technical depth or reasoning.`;
  } else if (baselineDecision === 'Strong Hire') {
    summary = `STRONG HIRE: Candidate demonstrated strong technical depth, clear communication, and correct code implementation (${overallFitmentAvg}% fitment).`;
  } else if (baselineDecision === 'Hire') {
    summary = `HIRE: Candidate met technical competency benchmarks with satisfactory problem-solving and communication skills (${overallFitmentAvg}% fitment).`;
  } else {
    summary = `NEUTRAL: Candidate scored ${overallFitmentAvg}%, below the 75% hire benchmark. Additional human review recommended for core skill gaps.`;
  }

  const aiAvailable = Boolean(getGeminiClient() || isGroqConfigured());
  const willQueueAiEval = Boolean(
    queueAiAsync && aiAvailable && !isSuspended && evaluatedTranscripts.length > 0
  );

  const initialDecision: ReportDecision = isSuspended || compliance.hasCriticalComplianceViolation
    ? 'Reject'
    : totalSuperficialAnswers >= 2 || overallFitmentAvg < 55
      ? 'Reject'
      : willQueueAiEval
        ? 'Review Pending'
        : baselineDecision;

  const evaluationStatus: EvaluationReport['evaluationStatus'] = isSuspended
    ? 'suspended'
    : willQueueAiEval
      ? 'pending_ai'
      : 'completed_baseline';

  const evaluationSource: EvaluationReport['evaluationSource'] = isSuspended
    ? 'proctor_suspension'
    : 'baseline_heuristic';

  const nowIso = new Date().toISOString();
  const existingHistory: EvaluationHistoryEntry[] = Array.isArray(candidate.feedbackReport?.evaluationHistory)
    ? [...candidate.feedbackReport.evaluationHistory]
    : [];

  existingHistory.push({
    stage: isSuspended ? 'proctor_suspension' : 'baseline_submitted',
    decision: initialDecision,
    overallScore: overallFitmentAvg,
    timestamp: nowIso,
    note: isSuspended
      ? 'Interview terminated by proctoring compliance controls.'
      : willQueueAiEval
        ? 'Deterministic baseline recorded; queued for retrospective AI evaluation.'
        : 'Finalized using deterministic baseline evaluation rubric.'
  });

  candidate.status = isSuspended ? 'Suspended' : 'Completed';
  candidate.completedAt = nowIso;
  candidate.proctoringSummary = compliance.normalizedSummary;
  candidate.feedbackReport = {
    decision: initialDecision,
    summary,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    cheatingRisk: compliance.cheatingRisk,
    cheatingLogs: compliance.cheatingLogs,
    transcripts: evaluatedTranscripts,
    evaluationStatus,
    evaluationSource,
    evaluationHistory: existingHistory
  };
  candidate.aiAssessmentScore = overallFitmentAvg;

  db.candidates[candIndex] = candidate;
  saveDb(db);

  if (willQueueAiEval) {
    queueCandidateForEvaluation(
      candidate.token,
      evaluatedTranscripts,
      compliance.normalizedSummary,
      isSuspended,
      compliance.hasCriticalComplianceViolation
    );
  }

  return {
    candidate,
    assessment,
    queuedAiEvaluation: willQueueAiEval
  };
}

/**
 * Enqueues candidate evaluation job for asynchronous AI retrospective processing.
 */
export function queueCandidateForEvaluation(
  candidateToken: string,
  transcripts: TranscriptEntry[],
  proctoringSummary: ProctoringSummary,
  isSuspended: boolean,
  hasCriticalComplianceViolation: boolean = false
) {
  evaluationQueue.push({
    candidateToken,
    transcripts,
    proctoringSummary,
    isSuspended,
    hasCriticalComplianceViolation
  });
  void processEvaluationQueue();
}

/**
 * Worker loop that evaluates candidates sequentially with gentle spacing to avoid rate limits.
 */
async function processEvaluationQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (evaluationQueue.length > 0) {
    const job = evaluationQueue.shift();
    if (!job) continue;

    try {
      console.log(
        `[Queue-Processor] Processing background assessment for Candidate Token: ${job.candidateToken}. Remaining in queue: ${evaluationQueue.length}`
      );
      await evaluateCandidateBackground(job);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Queue-Processor] Exception processing job for token: ${job.candidateToken}:`, msg);
    }
  }

  isProcessingQueue = false;
}

/**
 * Executes retrospective AI evaluation against candidate transcripts and proctoring metrics,
 * enforcing the same composite formula and compliance lock as baseline evaluation.
 */
export async function evaluateCandidateBackground(job: EvaluationJob): Promise<void> {
  const { candidateToken, transcripts, proctoringSummary, isSuspended, hasCriticalComplianceViolation } = job;
  const db = getDb();

  const candIndex = db.candidates.findIndex((c) => c.token === candidateToken);
  if (candIndex === -1) {
    console.error(`[Queue-Processor] Candidate with token ${candidateToken} not found in database.`);
    return;
  }

  const candidate = db.candidates[candIndex];
  const assessment = db.assessments.find((a) => a.id === candidate.assessmentId);
  const existingReport = candidate.feedbackReport;

  const ai = getGeminiClient();
  if ((!ai && !isGroqConfigured()) || isSuspended || transcripts.length === 0) {
    return;
  }

  try {
    const summaryPrompt = `
You are an executive technical interviewer and lead hiring manager at a top-tier tech enterprise. Perform an UNCOMPROMISING, MARKET-STANDARD retrospective technical evaluation of the candidate. Do NOT give generic, diplomatic, or artificially inflated feedback. If a candidate answered with single-word responses ("Yes/No"), gave wrong answers, or submitted broken code, state that directly, assign low scores (0-20%), and set decision to "Reject".

Job Title: ${assessment?.title || 'Engineer'}
Candidate Name: ${candidate.name}

Role Competency Framework:
- Mandatory Skills: ${JSON.stringify(assessment?.mandatorySkills || [])}
- Good-to-have Skills: ${JSON.stringify(assessment?.goodToHaveSkills || [])}
- NOTE ON GOOD-TO-HAVE: Questions belonging to good-to-have skills must NOT negatively impact the candidate score if missed or answered incorrectly. They serve as bonus credits only.

Proctoring Compliance Context:
- Tab Switches: ${proctoringSummary?.tabSwitches || 0}
- Copy Paste Actions: ${proctoringSummary?.copyPasteAttempts || 0}
- Eye Gaze Deviations: ${proctoringSummary?.notVisibleViolations || 0}
- Face Lost Events: ${proctoringSummary?.faceDetectionsLost || 0}
- Camera Offs: ${proctoringSummary?.cameraOffViolations || 0}

Interview Transcripts (Questions, Candidate Answers, Follow-up Questions & Answers):
${JSON.stringify(transcripts, null, 2)}

STRICT EVALUATION & SCORING RULES:

1. SINGLE-WORD / SUPERFICIAL / "YES-NO" / EVASIVE RESPONSES:
   - If candidate answered technical or coding questions with single words ("yes", "no", "ok", "idk", "pass") or superficial non-explanations:
     * Question score: MUST be 0 to 10 points out of 100.
     * technicalGrade: MUST be 0 to 20 points.
     * commGrade: MUST be 10 to 25 points (single-word responses reflect extremely poor interview communication).
     * decision: MUST be "Reject".
     * aiEvaluation for that question: MUST state "Candidate responded with only '[Answer]' without explaining any technical concept, logic, or syntax. Failed skill competency."
     * pros: MUST be ["No technical strengths demonstrated during the interview."].
     * cons: MUST include "Candidate gave single-word ('Yes/No') or evasive responses to core technical questions."

2. CODE EVALUATION & SYNTAX / LOGIC ERRORS:
   - If candidate code is broken, incomplete, contains syntax/logic bugs, or lacks executable structure:
     * Question score: MUST be 0 to 25 points.
     * problemSolvingGrade: MUST be 0 to 25 points.
     * aiEvaluation for code question: MUST state "Errors in code submission. Solution contains syntax/logic bugs and fails production suitability."

3. HIGH SCORES (>75%):
   - Candidate MUST provide clear, well-structured, technically accurate explanations with functional code to receive scores above 75.

4. FINAL VERDICT (summary):
   - MUST state directly: "FINAL VERDICT: [Strong Hire / Hire / Neutral / Reject] - [Direct 2-sentence explanation of why candidate passed or failed]."

Generate a structured JSON response matching the required schema.`;

    const response = await generateContentWithFallback(ai, {
      contents: summaryPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decision: { type: Type.STRING },
            summary: { type: Type.STRING },
            technicalGrade: { type: Type.INTEGER },
            commGrade: { type: Type.INTEGER },
            problemSolvingGrade: { type: Type.INTEGER },
            pros: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            cons: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            evaluatedTranscripts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  score: { type: Type.INTEGER },
                  aiEvaluation: { type: Type.STRING }
                },
                required: ['questionId', 'score', 'aiEvaluation']
              }
            }
          },
          required: ['decision', 'summary', 'technicalGrade', 'commGrade', 'problemSolvingGrade', 'pros', 'cons', 'evaluatedTranscripts']
        }
      }
    });

    const parsed = cleanAndParseJSON(response.text) as {
      decision?: string;
      summary?: string;
      technicalGrade?: number;
      commGrade?: number;
      problemSolvingGrade?: number;
      pros?: string[];
      cons?: string[];
      evaluatedTranscripts?: Array<{ questionId: string; score?: number; aiEvaluation?: string }>;
    };

    const technicalScore = Math.max(
      0,
      Math.min(100, Number(parsed.technicalGrade ?? existingReport?.technicalScore ?? 0))
    );
    const communicationScore = Math.max(
      0,
      Math.min(100, Number(parsed.commGrade ?? existingReport?.communicationScore ?? 0))
    );
    const problemSolvingScore = Math.max(
      0,
      Math.min(100, Number(parsed.problemSolvingGrade ?? existingReport?.problemSolvingScore ?? 0))
    );

    const compositeScore = computeCompositeScore(technicalScore, problemSolvingScore, communicationScore);
    const aiDecisionCandidate: FinalDecision =
      parsed.decision && VALID_AI_DECISIONS.has(parsed.decision)
        ? (parsed.decision as FinalDecision)
        : deriveDecisionFromScore(compositeScore, { isSuspended, hasCriticalComplianceViolation });

    // Compliance Lock: critical proctoring violations cannot be upgraded above Reject by AI.
    const finalDecision: FinalDecision =
      isSuspended || hasCriticalComplianceViolation ? 'Reject' : aiDecisionCandidate;

    let finalSummary =
      parsed.summary || existingReport?.summary || 'The candidate completed all sections of the interview.';
    if (hasCriticalComplianceViolation && finalDecision === 'Reject' && !finalSummary.toUpperCase().includes('COMPLIANCE')) {
      finalSummary = `COMPLIANCE REJECT (Proctoring Lock Applied): ${finalSummary}`;
    }

    const pros = Array.isArray(parsed.pros) ? parsed.pros : [];
    const cons = Array.isArray(parsed.cons) ? parsed.cons : [];

    const updatedTranscripts: TranscriptEntry[] = transcripts.map((t) => {
      const copy: TranscriptEntry = { ...t };
      const evalResult = Array.isArray(parsed.evaluatedTranscripts)
        ? parsed.evaluatedTranscripts.find((et) => et.questionId === copy.questionId)
        : undefined;
      if (evalResult) {
        copy.score = Math.max(0, Math.min(100, Number(evalResult.score ?? copy.score ?? 0)));
        copy.aiEvaluation = evalResult.aiEvaluation ?? copy.aiEvaluation ?? 'Response analyzed.';
        if (copy.crossAnswerText) {
          copy.crossAiEvaluation = copy.aiEvaluation;
        }
      }
      return copy;
    });

    const freshDb = getDb();
    const freshedCandIndex = freshDb.candidates.findIndex((c) => c.token === candidateToken);
    if (freshedCandIndex !== -1) {
      const freshedCand = freshDb.candidates[freshedCandIndex];
      const history: EvaluationHistoryEntry[] = Array.isArray(freshedCand.feedbackReport?.evaluationHistory)
        ? [...freshedCand.feedbackReport.evaluationHistory]
        : [];
      history.push({
        stage: 'ai_retrospective',
        decision: finalDecision,
        overallScore: compositeScore,
        timestamp: new Date().toISOString(),
        note: hasCriticalComplianceViolation
          ? 'Retrospective AI evaluation completed with proctoring compliance reject lock preserved.'
          : 'Retrospective AI evaluation finalized report.'
      });

      freshedCand.feedbackReport = {
        ...(freshedCand.feedbackReport || {
          cheatingRisk: 'Low',
          cheatingLogs: [],
          transcripts: []
        }),
        decision: finalDecision,
        summary: finalSummary,
        technicalScore,
        communicationScore,
        problemSolvingScore,
        pros,
        cons,
        transcripts: updatedTranscripts,
        evaluationStatus: 'completed_ai',
        evaluationSource: 'ai_retrospective',
        evaluationHistory: history
      };
      freshedCand.aiAssessmentScore = compositeScore;
      freshDb.candidates[freshedCandIndex] = freshedCand;
      saveDb(freshDb);
      console.log(`[Queue-Processor] Successfully compiled background report for candidate: ${freshedCand.name}`);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      '[Queue-Processor] AI evaluation error, resolving baseline verdict so candidate is not stuck pending:',
      errMsg
    );
    const freshDb = getDb();
    const freshedCandIndex = freshDb.candidates.findIndex((c) => c.token === candidateToken);
    if (freshedCandIndex !== -1) {
      const freshedCand = freshDb.candidates[freshedCandIndex];
      if (freshedCand.feedbackReport) {
        const avgScore = freshedCand.aiAssessmentScore ?? 0;
        const resolvedDecision = deriveDecisionFromScore(avgScore, {
          isSuspended,
          hasCriticalComplianceViolation
        });
        const history: EvaluationHistoryEntry[] = Array.isArray(freshedCand.feedbackReport.evaluationHistory)
          ? [...freshedCand.feedbackReport.evaluationHistory]
          : [];
        history.push({
          stage: 'baseline_fallback',
          decision: resolvedDecision,
          overallScore: avgScore,
          timestamp: new Date().toISOString(),
          note: `AI provider error (${errMsg.slice(0, 120)}); finalized with deterministic baseline rubric.`
        });

        freshedCand.feedbackReport.decision = resolvedDecision;
        freshedCand.feedbackReport.evaluationStatus = 'completed_baseline';
        freshedCand.feedbackReport.evaluationSource = 'baseline_heuristic';
        freshedCand.feedbackReport.evaluationHistory = history;
        freshDb.candidates[freshedCandIndex] = freshedCand;
        saveDb(freshDb);
      }
    }
  }
}
