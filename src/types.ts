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
  recordingUrl?: string;
  recordingDuration?: number;
  selectionStatus?: 'Selected' | 'Not Selected' | 'Processing';
}
