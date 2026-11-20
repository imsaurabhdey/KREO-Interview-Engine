/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Job Description Skill Extraction & Multi-Section Assessment Generation Routes.
 */

import { Router } from 'express';
import { Type } from '@google/genai';
import { getDb, saveDb } from '../db';
import { Assessment, Question } from '../types';
import { getGeminiClient, generateContentWithFallback, cleanAndParseJSON, isGroqConfigured } from '../gemini';
import { extractSkillsOffline, generateAssessmentQuestions } from '../questionGenerator';
import { requireAuth, requireRole, canAccessOrg, logAuditEvent } from '../authMiddleware';

export const assessmentRouter = Router();

// Require verified Recruiter/Admin session across all assessment routes
assessmentRouter.use(requireAuth);

const VALID_ASSESSMENT_STATUSES = new Set(['Draft', 'Published', 'Closed']);
const ALLOWED_STATUS_TRANSITIONS: Record<string, Set<string>> = {
  Draft: new Set(['Draft', 'Published', 'Closed']),
  Published: new Set(['Published', 'Closed', 'Draft']),
  Closed: new Set(['Closed', 'Published'])
};

function validateAssessmentFields(body: any, isUpdate = false): string | null {
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length > 200) {
      return 'Assessment title must be a string of at most 200 characters.';
    }
    if (!isUpdate && body.title.trim().length === 0) {
      return 'Assessment title cannot be empty.';
    }
  }
  if (body.status !== undefined && !VALID_ASSESSMENT_STATUSES.has(body.status)) {
    return 'Invalid assessment status. Allowed values: Draft, Published, Closed.';
  }
  if (body.techCount !== undefined) {
    const n = Number(body.techCount);
    if (!Number.isFinite(n) || n < 0 || n > 50) {
      return 'techCount must be a number between 0 and 50.';
    }
  }
  if (body.codingCount !== undefined) {
    const n = Number(body.codingCount);
    if (!Number.isFinite(n) || n < 0 || n > 20) {
      return 'codingCount must be a number between 0 and 20.';
    }
  }
  if (body.questions !== undefined && !Array.isArray(body.questions)) {
    return 'questions must be an array.';
  }
  if (body.jdText !== undefined && typeof body.jdText !== 'string') {
    return 'jdText must be a string.';
  }
  return null;
}

// Extract Skills from JD Endpoint
assessmentRouter.post('/extract-skills', async (req, res) => {
  const { title, roleLevel, experienceRequired, jdText } = req.body;
  if (!jdText) {
    return res.status(400).json({ error: 'Job description text is required.' });
  }

  const ai = getGeminiClient();
  let skillsExtracted: string[] = [];

  if (ai || isGroqConfigured()) {
    try {
      const skillsPrompt = `
Analyze the following Job Description (JD) text and extract ALL specific, granular skill terms mentioned or directly required.
This must include:
1. Core programming languages, frameworks, packages, database engines, and cloud tools (e.g., "Java", "Spring Boot", "React", "PostgreSQL", "Docker").
2. Specific technical sub-domains, architectural concepts, and lower-level execution skills (e.g., "Multithreading", "Concurrency Control", "Thread Safety", "GC Tuning", "Memory Management", "Socket Programming").
3. Methodologies, data engineering techniques, testing patterns (e.g., "ETL", "QA Automation", "SIT", "Unit Testing", "API Mocking").
4. Crucial professional attributes or soft skills explicitly mentioned as requirements (e.g., "Technical Communication", "Stakeholder Alignment", "Agile Collaboration").

CRITICAL INSTRUCTION:
- Avoid broad, empty, or overly generalized category names (like "Data Analysis", "Database Administration", "Testing"). Instead, extract the specific granular terms like "SQL Querying", "Index Optimization", "Regression Testing", "Multithreading".
- Each item must be a real, crisp, searchable skill term (1 to 4 words maximum).
- Extract between 10 to 20 highly specific skills directly from the JD text. Do not invent keywords that have no relevance to the actual text.

Role Info:
- Title target: ${title || 'Software Specialist'}
- Seniority Target: ${roleLevel || 'Mid-Level'}
- JD Text: "${jdText}"

Output strictly in JSON structure matching this exact format:
{
  "skillsExtracted": ["Skill 1", "Skill 2"]
}
`;

      const timeoutPromise = new Promise<any[]>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 15s')), 15000)
      );

      const apiPromise = async () => {
        const response = await generateContentWithFallback(ai, {
          contents: skillsPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                skillsExtracted: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ['skillsExtracted']
            }
          }
        });
        const parsed = cleanAndParseJSON(response.text);
        return parsed.skillsExtracted || [];
      };

      const result = await Promise.race([apiPromise(), timeoutPromise]);
      if (result && Array.isArray(result)) {
        skillsExtracted = result.map((s: string) => s.trim()).filter(Boolean);
      }
    } catch (e: any) {
      console.warn('[GEMINI SKILL EXTRACTION TIMEOUT OR FAIL] Gracefully utilizing offline matcher:', e.message || e);
    }
  }

  if (skillsExtracted.length === 0) {
    skillsExtracted = extractSkillsOffline(jdText, title);
  }

  res.json({ skillsExtracted });
});

// Universal Dynamic Skills Exploration & Auto-Suggestion Endpoint
assessmentRouter.get('/skills/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    return res.json({ query: '', aiSuggestions: [] });
  }

  const ai = getGeminiClient();
  let aiSuggestions: { name: string; category?: string; related: string[] }[] = [];

  if ((ai || isGroqConfigured()) && query.length >= 2) {
    try {
      const prompt = `Given the candidate skill or competency query "${query}", return 4 to 6 industry standard skill names that match or closely relate to it.
Focus on modern engineering, concurrency, low latency, software development, data, cloud, or enterprise IT.
Output format JSON:
{
  "skills": [
    { "name": "Standardized Skill Name", "category": "Category Name", "related": ["Related 1", "Related 2", "Related 3"] }
  ]
}`;
      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              skills: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    related: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['name', 'related']
                }
              }
            },
            required: ['skills']
          }
        }
      });
      const parsed = cleanAndParseJSON(response.text);
      if (parsed.skills && Array.isArray(parsed.skills)) {
        aiSuggestions = parsed.skills;
      }
    } catch (err: any) {
      console.warn('[AI SKILL SEARCH] Suggestion fallback:', err?.message || err);
    }
  }

  res.json({ query, aiSuggestions });
});

// Get all assessments scoped to caller's organization
assessmentRouter.get('/', (req, res) => {
  const db = getDb();
  const scoped = (db.assessments || []).filter((a) => canAccessOrg(req.authUser!, a.orgName));
  res.json(scoped);
});

// Get single assessment by ID (scoped to caller's organization)
assessmentRouter.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const asmt = (db.assessments || []).find((a) => a.id === id && canAccessOrg(req.authUser!, a.orgName));
  if (!asmt) {
    return res.status(404).json({ error: 'Assessment not found.' });
  }
  res.json(asmt);
});

// Direct Assessment Creation endpoint
assessmentRouter.post('/', (req, res) => {
  const { 
    title, 
    roleLevel = 'Mid-Level', 
    experienceRequired = '2-5 Years', 
    jdText = '', 
    skillsExtracted = [], 
    mandatorySkills = [], 
    goodToHaveSkills = [], 
    questions = [], 
    techCount = 5, 
    codingCount = 2, 
    locations = [], 
    roundsEnabled = { tech: true, coding: true },
    status = 'Published'
  } = req.body;

  const validationErr = validateAssessmentFields(req.body, false);
  if (validationErr) {
    return res.status(400).json({ error: validationErr });
  }

  const db = getDb();
  const now = new Date().toISOString();

  const newAsmt: Assessment = {
    id: `asmt-${Date.now()}`,
    title: (title || 'Custom Assessment').trim(),
    roleLevel,
    experienceRequired,
    jdText: jdText || 'Custom Requisition',
    skillsExtracted: skillsExtracted.length > 0 ? skillsExtracted : [...mandatorySkills, ...goodToHaveSkills],
    mandatorySkills,
    goodToHaveSkills,
    status,
    createdAt: now,
    createdByEmail: req.authUser!.email,
    createdByName: req.authUser!.name,
    updatedAt: now,
    updatedByEmail: req.authUser!.email,
    updatedByName: req.authUser!.name,
    orgName: req.authUser!.orgName,
    auditHistory: [
      {
        action: 'CREATED',
        actorEmail: req.authUser!.email,
        actorName: req.authUser!.name,
        timestamp: now,
        summary: `Created assessment (${status})`
      }
    ],
    questions,
    techCount,
    codingCount,
    locations,
    roundsEnabled
  };

  if (!db.assessments) db.assessments = [];
  db.assessments.unshift(newAsmt);
  saveDb(db, true);
  logAuditEvent('ASSESSMENT_CREATE', req.authUser!, { assessmentId: newAsmt.id, title: newAsmt.title });
  res.status(201).json(newAsmt);
});

// Create Assessment / Question Pool Generation Endpoint
assessmentRouter.post('/generate-from-jd', async (req, res) => {
  const { title, roleLevel, experienceRequired, jdText, mandatorySkills = [], goodToHaveSkills = [], settings } = req.body;
  
  if (!jdText) {
    return res.status(400).json({ error: 'Job description text is required.' });
  }

  const techCount = settings?.techCount || 15;
  const codingCount = settings?.codingCount || 3;

  const allSkills = Array.from(new Set(
    [...mandatorySkills, ...goodToHaveSkills]
      .filter(Boolean)
      .map(s => typeof s === 'string' ? s.trim() : String(s).trim())
      .filter(s => s.length > 0)
  ));
  if (allSkills.length === 0) {
    allSkills.push('Software Engineering', 'System Design', 'Algorithms', 'Databases', 'API Integration');
  }

  const ai = getGeminiClient();
  const finalQuestionsBank: Question[] = await generateAssessmentQuestions(ai, {
    title,
    roleLevel,
    experienceRequired,
    jdText,
    mandatorySkills,
    goodToHaveSkills
  });

  const db = getDb();
  const now = new Date().toISOString();

  const generatedAssessment: Assessment = {
    id: `asmt-${Date.now()}`,
    title: (title || 'Custom Role Assessment').trim(),
    roleLevel: roleLevel || 'Mid-Level',
    experienceRequired: experienceRequired || 'Flexible',
    jdText,
    skillsExtracted: allSkills,
    mandatorySkills,
    goodToHaveSkills,
    status: 'Draft',
    createdAt: now,
    createdByEmail: req.authUser!.email,
    createdByName: req.authUser!.name,
    updatedAt: now,
    updatedByEmail: req.authUser!.email,
    updatedByName: req.authUser!.name,
    orgName: req.authUser!.orgName,
    auditHistory: [
      {
        action: 'GENERATED',
        actorEmail: req.authUser!.email,
        actorName: req.authUser!.name,
        timestamp: now,
        summary: `Generated draft assessment with ${finalQuestionsBank.length} questions`
      }
    ],
    questions: finalQuestionsBank,
    techCount,
    codingCount,
    locations: req.body.locations || [],
    roundsEnabled: req.body.roundsEnabled || { tech: true, coding: true }
  };

  if (!db.assessments) db.assessments = [];
  db.assessments.unshift(generatedAssessment);
  saveDb(db, true);
  logAuditEvent('ASSESSMENT_GENERATE', req.authUser!, { assessmentId: generatedAssessment.id });
  res.json(generatedAssessment);
});

// Update Assessment to Publish/Draft/Closed state (validated & audited, scoped to organization)
assessmentRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, title, questions, techCount, codingCount, mandatorySkills, goodToHaveSkills, skillsExtracted, locations, roundsEnabled } = req.body;

  const validationErr = validateAssessmentFields(req.body, true);
  if (validationErr) {
    return res.status(400).json({ error: validationErr });
  }

  const db = getDb();
  const asmtIndex = db.assessments.findIndex((a) => a.id === id && canAccessOrg(req.authUser!, a.orgName));
  if (asmtIndex === -1) {
    return res.status(404).json({ error: 'Assessment not found.' });
  }

  const existing = db.assessments[asmtIndex];
  const currentStatus = existing.status || 'Draft';

  if (status !== undefined) {
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || VALID_ASSESSMENT_STATUSES;
    if (!allowedNext.has(status)) {
      return res.status(400).json({
        error: `Invalid state transition: Cannot move assessment directly from "${currentStatus}" to "${status}".`
      });
    }
    existing.status = status;
  }

  if (title !== undefined) existing.title = title.trim();
  if (questions !== undefined) existing.questions = questions;
  if (techCount !== undefined) existing.techCount = Number(techCount);
  if (codingCount !== undefined) existing.codingCount = Number(codingCount);
  if (mandatorySkills !== undefined) existing.mandatorySkills = mandatorySkills;
  if (goodToHaveSkills !== undefined) existing.goodToHaveSkills = goodToHaveSkills;
  if (skillsExtracted !== undefined) existing.skillsExtracted = skillsExtracted;
  if (locations !== undefined) existing.locations = locations;
  if (roundsEnabled !== undefined) existing.roundsEnabled = roundsEnabled;

  const now = new Date().toISOString();
  existing.updatedAt = now;
  existing.updatedByEmail = req.authUser!.email;
  existing.updatedByName = req.authUser!.name;
  const history = Array.isArray(existing.auditHistory) ? existing.auditHistory : [];
  history.push({
    action: status && status !== currentStatus ? `STATUS_${status.toUpperCase()}` : 'UPDATED',
    actorEmail: req.authUser!.email,
    actorName: req.authUser!.name,
    timestamp: now,
    summary: status && status !== currentStatus
      ? `Status changed from ${currentStatus} to ${status}`
      : 'Updated assessment configuration'
  });
  existing.auditHistory = history.slice(-30);

  saveDb(db, true);
  logAuditEvent('ASSESSMENT_UPDATE', req.authUser!, { assessmentId: id, status: existing.status });
  res.json(existing);
});

// Delete Assessment (Verified Admin Role Only — never trusts client headers)
assessmentRouter.delete('/:id', requireRole('Admin'), (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const target = (db.assessments || []).find((a) => a.id === id && canAccessOrg(req.authUser!, a.orgName));
  if (!target) {
    return res.status(404).json({ error: 'Assessment not found.' });
  }

  db.assessments = db.assessments.filter((a) => a.id !== id);
  saveDb(db, true);
  logAuditEvent('ASSESSMENT_DELETE', req.authUser!, { assessmentId: id, title: target.title });
  res.json({ success: true });
});
