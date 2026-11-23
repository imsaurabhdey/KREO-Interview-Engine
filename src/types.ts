/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RoleType = 'Admin' | 'Recruiter';

export type QuestionCategory = 'hr' | 'tech' | 'coding' | 'intro';

export interface QuestionBankItem {
  id: string;
  skill: string;          // e.g. "Java", "Python", "React"
  skillCategory?: string;  // e.g. "Development Technologies"
  subTopic?: string;      // competency e.g. "JVM execution and bytecode"
  difficulty: 'Easy' | 'Moderate' | 'Difficult' | 'High';
  category: 'Technical' | 'Coding' | 'HR' | 'Behavioral';
  question: string;
  sampleAnswer?: string;
  evaluationRubric?: string;
  codeSnippet?: string;
  starterCode?: string;
  testCases?: Array<{ input: string; output: string }>;
  createdAt: string;
  updatedAt: string;
  createdByEmail?: string;
  updatedByEmail?: string;
  version?: number;
  revisions?: Array<{
    version: number;
    question: string;
    difficulty: string;
    category: string;
    sampleAnswer?: string;
    evaluationRubric?: string;
    editedByEmail: string;
    editedAt: string;
  }>;
  source?: 'default_bank' | 'manual' | 'bulk_import';
  embedding?: number[];
}

export interface Question {
  id: string;
  category: QuestionCategory;
  question: string;
  difficulty: 'Easy' | 'Moderate' | 'High';
  suggestedAnswer?: string;
  starterCode?: string;
  starterCodes?: { language: string; code: string }[];
  testCases?: { input: string; output: string }[];
  targetedSkill?: string;
  isGoodToHave?: boolean;
}

export interface Assessment {
  id: string;
  title: string;
  roleLevel: string;
  experienceRequired: string;
  jdText: string;
  skillsExtracted: string[];
  mandatorySkills?: string[];
  goodToHaveSkills?: string[];
  status: 'Draft' | 'Published' | 'Closed';
  createdAt: string;
  questions: Question[];
  hrCount?: number;
  techCount?: number;
  codingCount?: number;
  locations?: string[];
  createdByEmail?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedByEmail?: string;
  updatedByName?: string;
  orgName?: string;
  auditHistory?: Array<{
    action: string;
    actorEmail: string;
    actorName: string;
    timestamp: string;
    summary?: string;
  }>;
  roundsEnabled?: {
    tech: boolean;
    coding: boolean;
    hr?: boolean;
  };
}

export interface ProctoringSummary {
  tabSwitches: number;
  browserFocusViolations: number;
  faceDetectionsLost: number;
  copyPasteAttempts?: number;
  cameraOffViolations?: number;
  notVisibleViolations?: number;
  audioDetectedViolations?: number;
  multiplePeopleViolations?: number;
  phoneViolations?: number;
  exitFullscreenCount?: number;
}

export interface TranscriptEntry {
  questionId: string;
  category: QuestionCategory;
  questionText: string;
  candidateAnswer: string;
  aiEvaluation: string;
  score: number; // 0 - 100
  crossQuestionText?: string;
  crossAnswerText?: string;
  crossAiEvaluation?: string;
  codeLanguage?: string;
  codeExecutionOutput?: string;
}

export interface EvaluationHistoryEntry {
  stage: 'baseline_submitted' | 'ai_retrospective' | 'baseline_fallback' | 'proctor_suspension';
  decision: 'Strong Hire' | 'Hire' | 'Neutral' | 'Reject' | 'Review Pending';
  overallScore: number;
  timestamp: string;
  note: string;
}

export interface EvaluationReport {
  decision: 'Strong Hire' | 'Hire' | 'Neutral' | 'Reject' | 'Review Pending';
  summary: string;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  cheatingRisk: 'Low' | 'Medium' | 'High';
  cheatingLogs: string[];
  transcripts: TranscriptEntry[];
  pros?: string[];
  cons?: string[];
  evaluationStatus?: 'in_progress' | 'pending_ai' | 'completed_ai' | 'completed_baseline' | 'suspended';
  evaluationSource?: 'ai_retrospective' | 'baseline_heuristic' | 'proctor_suspension';
  evaluationHistory?: EvaluationHistoryEntry[];
}

export type HumanReviewDecision = 'Shortlisted' | 'On Hold' | 'Rejected' | 'Hired';

export interface HumanReview {
  decision: HumanReviewDecision;
  notes: string;
  reviewedByEmail: string;
  reviewedByName: string;
  reviewedAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  assessmentId: string;
  status: 'Pending' | 'Invite Pending' | 'Invited' | 'Candidate Invited' | 'In Progress' | 'Ongoing' | 'Completed' | 'Suspended' | 'Pending & Incomplete' | 'Pending and Incomplete';
  token: string;
  proctoringSummary?: ProctoringSummary;
  feedbackReport?: EvaluationReport;
  startedAt?: string;
  completedAt?: string;
  experience?: string;
  skillsExtracted?: string[];
  location?: string;
  aiAssessmentScore?: number;
  createdAt?: string;
  createdByEmail?: string;
  createdByName?: string;
  orgName?: string;
  recordingUrl?: string;
  recordingDuration?: number;
  selectionStatus?: 'Selected' | 'Not Selected' | 'Processing';
  tokenExpiresAt?: string;
  consentAcceptedAt?: string;
  humanReview?: HumanReview;
}
