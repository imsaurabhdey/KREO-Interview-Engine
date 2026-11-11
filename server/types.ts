/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, QuestionCategory, QuestionBankItem, Assessment, Candidate, EvaluationReport, ProctoringSummary, TranscriptEntry } from '../src/types';

export type { Question, QuestionCategory, QuestionBankItem, Assessment, Candidate, EvaluationReport, ProctoringSummary, TranscriptEntry };

export type UserRole = 'Admin' | 'Recruiter';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  orgName?: string;
  createdAt: string;
}

export interface DbStore {
  assessments: Assessment[];
  candidates: Candidate[];
  accounts: UserAccount[];
  users?: UserAccount[];
  questionBank?: QuestionBankItem[];
}

export interface EvaluationJob {
  candidateToken: string;
  transcripts: TranscriptEntry[];
  proctoringSummary: ProctoringSummary;
  isSuspended: boolean;
}

export interface EmailDispatchOptions {
  assessmentTitle?: string;
  startLink?: string;
  score?: number;
}

export interface EmailDispatchResult {
  success: boolean;
  mode: 'sent' | 'simulated';
  error?: string;
}

export interface CodeExecutionResult {
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  language: string;
  version: string;
}
