/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Isolated Demo Interview Fixture used exclusively by the Recruiter "Test Environment"
 * sandbox mode, kept separate from production candidate interview logic.
 */

import type { Assessment, Candidate } from '../types';

export function createDemoInterviewFixture(): { candidate: Candidate; assessment: Assessment } {
  const nowIso = new Date().toISOString();

  const candidate: Candidate = {
    id: 'demo123',
    name: 'Saurabh Dey',
    email: 'saurabh.dey@irissoftware.com',
    phone: 'N/A',
    assessmentId: 'demo-asmt',
    status: 'Pending',
    token: 'demo',
    createdAt: nowIso
  };

  const assessment: Assessment = {
    id: 'demo-asmt',
    title: 'DevOps Engineer (Demo Test)',
    roleLevel: 'Mid-Level',
    experienceRequired: '3-6 Years',
    jdText: 'Cloud Infrastructure & DevOps Demo Environment',
    skillsExtracted: ['AWS', 'Kubernetes', 'Terraform', 'Python'],
    status: 'Published',
    createdAt: nowIso,
    questions: [
      {
        id: 'demo-q1',
        category: 'hr',
        question:
          'Please introduce yourself, state your current notice period, and describe your experience managing cloud infrastructure on AWS and Kubernetes.',
        difficulty: 'Easy'
      },
      {
        id: 'demo-q2',
        category: 'tech',
        question:
          'Explain how Kubernetes Pod autoscaling (HPA) works based on custom metrics and CPU utilization thresholds.',
        difficulty: 'Moderate'
      },
      {
        id: 'demo-q3',
        category: 'tech',
        question:
          'What is the difference between Terraform state locking and backend remote state storage in collaborative CI/CD pipelines?',
        difficulty: 'Moderate'
      },
      {
        id: 'demo-q4',
        category: 'coding',
        question:
          'Write a Python snippet or Bash script that parses server access logs to count HTTP 5xx error occurrences per IP address.',
        difficulty: 'Moderate',
        suggestedAnswer:
          'import re\n\ndef parse_logs(log_lines):\n    error_counts = {}\n    for line in log_lines:\n        if " 5" in line:\n            ip = line.split()[0]\n            error_counts[ip] = error_counts.get(ip, 0) + 1\n    return error_counts'
      }
    ]
  };

  return { candidate, assessment };
}
