/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Interview Assessment Queue, Multi-Modal Scoring & Retrospective Evaluation Service.
 */

import { Type } from '@google/genai';
import { getDb, saveDb } from './db';
import { getGeminiClient, generateContentWithFallback, isGroqConfigured } from './gemini';

export interface EvaluationJob {
  candidateToken: string;
  transcripts: any[];
  proctoringSummary: any;
  isSuspended: boolean;
}

const evaluationQueue: EvaluationJob[] = [];
let isProcessingQueue = false;

/**
 * Enqueues candidate evaluation job for asynchronous processing.
 */
export function queueCandidateForEvaluation(
  candidateToken: string,
  transcripts: any[],
  proctoringSummary: any,
  isSuspended: boolean
) {
  evaluationQueue.push({ candidateToken, transcripts, proctoringSummary, isSuspended });
  processEvaluationQueue();
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
      console.log(`[Queue-Processor] Processing background assessment for Candidate Token: ${job.candidateToken}. Remaining in queue: ${evaluationQueue.length}`);
      await evaluateCandidateBackground(job);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err: any) {
      console.error(`[Queue-Processor] Exception processing job for token: ${job.candidateToken}:`, err.message || err);
    }
  }

  isProcessingQueue = false;
}

/**
 * Executes retrospective AI evaluation against candidate transcripts and proctoring metrics.
 */
export async function evaluateCandidateBackground(job: EvaluationJob) {
  const { candidateToken, transcripts, proctoringSummary, isSuspended } = job;
  const db = getDb();

  const candIndex = db.candidates.findIndex((c) => c.token === candidateToken);
  if (candIndex === -1) {
    console.error(`[Queue-Processor] Candidate with token ${candidateToken} not found in database.`);
    return;
  }

  const candidate = db.candidates[candIndex];
  const assessment = db.assessments.find((a) => a.id === candidate.assessmentId);

  let technicalScore = 70;
  let communicationScore = 75;
  let problemSolvingScore = 70;
  let summary = 'The candidate completed all sections of the interview.';
  let decision: 'Strong Hire' | 'Hire' | 'Neutral' | 'Reject' = 'Hire';
  let pros: string[] = ['Standard technical knowledge.', 'Completed basic questions.'];
  let cons: string[] = ['Requires deeper verification.'];

  const ai = getGeminiClient();
  if ((ai || isGroqConfigured()) && !isSuspended && transcripts.length > 0) {
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

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (parsed.decision) decision = parsed.decision;
      if (parsed.summary) summary = parsed.summary;
      if (parsed.technicalGrade !== undefined) technicalScore = Number(parsed.technicalGrade);
      if (parsed.commGrade !== undefined) communicationScore = Number(parsed.commGrade);
      if (parsed.problemSolvingGrade !== undefined) problemSolvingScore = Number(parsed.problemSolvingGrade);
      if (parsed.pros && Array.isArray(parsed.pros)) pros = parsed.pros;
      if (parsed.cons && Array.isArray(parsed.cons)) cons = parsed.cons;

      if (parsed.evaluatedTranscripts && Array.isArray(parsed.evaluatedTranscripts)) {
        transcripts.forEach((t: any) => {
          const evalResult = parsed.evaluatedTranscripts.find((et: any) => et.questionId === t.questionId);
          if (evalResult) {
            t.score = evalResult.score ?? 75;
            t.aiEvaluation = evalResult.aiEvaluation ?? 'Response analyzed and categorized successfully.';
            if (t.crossAnswerText) {
              t.crossAiEvaluation = evalResult.aiEvaluation;
            }
          }
        });
      }

      const freshDb = getDb();
      const freshedCandIndex = freshDb.candidates.findIndex((c) => c.token === candidateToken);
      if (freshedCandIndex !== -1) {
        const freshedCand = freshDb.candidates[freshedCandIndex];
        freshedCand.feedbackReport = {
          ...freshedCand.feedbackReport,
          decision,
          summary,
          technicalScore,
          communicationScore,
          problemSolvingScore,
          pros,
          cons,
          transcripts
        };
        freshedCand.aiAssessmentScore = Math.max(
          0,
          Math.min(100, Math.round(technicalScore * 0.5 + communicationScore * 0.25 + problemSolvingScore * 0.25))
        );
        freshDb.candidates[freshedCandIndex] = freshedCand;
        saveDb(freshDb);
        console.log(`[Queue-Processor] Successfully compiled background report for candidate: ${freshedCand.name}`);
      }
    } catch (err) {
      console.error('[Queue-Processor] Gemini evaluation error, keeping offline baseline parameters', err);
    }
  }
}
