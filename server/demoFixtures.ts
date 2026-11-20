/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Development-only fixture data kept isolated from production route logic.
 */

export interface ExtractedCandidateFixture {
  name: string;
  email: string;
  phone: string;
  experience: string;
  skills: string[];
  location: string;
}

export const DEV_ZIP_SAMPLE_CANDIDATES: ExtractedCandidateFixture[] = [
  {
    name: 'Arjun Mehta',
    email: 'arjun.mehta@dev-applications.net',
    phone: '+91 9123456789',
    experience: '5 Years',
    skills: ['React', 'Node.js', 'Next.js', 'Tailwind CSS', 'Redux'],
    location: 'Bengaluru, India'
  },
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@talentpool.org',
    phone: '+91 9876543210',
    experience: '3 Years',
    skills: ['TypeScript', 'Vue.js', 'Express', 'PostgreSQL', 'Docker'],
    location: 'Noida, India'
  },
  {
    name: 'Vikram Singh',
    email: 'v.singh@careerhub.com',
    phone: '+91 8765432109',
    experience: '7 Years',
    skills: ['Python', 'FastAPI', 'AWS', 'Kubernetes', 'NLP', 'CI/CD'],
    location: 'Mumbai, India'
  }
];
