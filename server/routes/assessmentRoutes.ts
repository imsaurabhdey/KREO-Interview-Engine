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

export const assessmentRouter = Router();

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

// Get all assessments endpoint
assessmentRouter.get('/', (req, res) => {
  const db = getDb();
  res.json(db.assessments || []);
});

// Get single assessment by ID
assessmentRouter.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const asmt = (db.assessments || []).find(a => a.id === id);
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

  const db = getDb();

  let resolvedName = req.body.createdByName;
  if (req.body.createdByEmail) {
    const accountMatch = (db.accounts || []).find((a: any) => a.email && a.email.toLowerCase().trim() === req.body.createdByEmail.toLowerCase().trim());
    if (accountMatch && accountMatch.name) {
      resolvedName = accountMatch.name;
    }
  }
  if (!resolvedName && req.body.createdByEmail) {
    const parts = req.body.createdByEmail.split('@')[0].split(/[._-]/);
    resolvedName = parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  const newAsmt: Assessment = {
    id: `asmt-${Date.now()}`,
    title: title || 'Custom Assessment',
    roleLevel,
    experienceRequired,
    jdText: jdText || 'Custom Requisition',
    skillsExtracted: skillsExtracted.length > 0 ? skillsExtracted : [...mandatorySkills, ...goodToHaveSkills],
    mandatorySkills,
    goodToHaveSkills,
    status,
    createdAt: new Date().toISOString(),
    createdByEmail: req.body.createdByEmail || undefined,
    createdByName: resolvedName || 'Saurabh Dey',
    questions,
    techCount,
    codingCount,
    locations,
    roundsEnabled
  };

  if (!db.assessments) db.assessments = [];
  db.assessments.unshift(newAsmt);
  saveDb(db, true);
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

  let resolvedName = req.body.createdByName;
  if (req.body.createdByEmail) {
    const accountMatch = (db.accounts || []).find((a: any) => a.email && a.email.toLowerCase().trim() === req.body.createdByEmail.toLowerCase().trim());
    if (accountMatch && accountMatch.name) {
      resolvedName = accountMatch.name;
    }
  }
  if (!resolvedName && req.body.createdByEmail) {
    const parts = req.body.createdByEmail.split('@')[0].split(/[._-]/);
    resolvedName = parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  const generatedAssessment: Assessment = {
    id: `asmt-${Date.now()}`,
    title: title || 'Custom Role Assessment',
    roleLevel: roleLevel || 'Mid-Level',
    experienceRequired: experienceRequired || 'Flexible',
    jdText,
    skillsExtracted: allSkills,
    mandatorySkills,
    goodToHaveSkills,
    status: 'Draft',
    createdAt: new Date().toISOString(),
    createdByEmail: req.body.createdByEmail || undefined,
    createdByName: resolvedName || 'Saurabh Dey',
    questions: finalQuestionsBank,
    techCount,
    codingCount,
    locations: req.body.locations || [],
    roundsEnabled: req.body.roundsEnabled || { tech: true, coding: true }
  };

  if (!db.assessments) db.assessments = [];
  db.assessments.unshift(generatedAssessment);
  saveDb(db, true);
  res.json(generatedAssessment);
});

// Update Assessment to Publish/Draft state
assessmentRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, title, questions, hrCount, techCount, codingCount, mandatorySkills, goodToHaveSkills, skillsExtracted, locations, roundsEnabled } = req.body;

  const db = getDb();
  const asmtIndex = db.assessments.findIndex(a => a.id === id);
  if (asmtIndex === -1) {
    return res.status(404).json({ error: 'Assessment not found.' });
  }

  if (status) db.assessments[asmtIndex].status = status;
  if (title) db.assessments[asmtIndex].title = title;
  if (questions) db.assessments[asmtIndex].questions = questions;
  if (techCount !== undefined) db.assessments[asmtIndex].techCount = techCount;
  if (codingCount !== undefined) db.assessments[asmtIndex].codingCount = codingCount;
  if (mandatorySkills !== undefined) db.assessments[asmtIndex].mandatorySkills = mandatorySkills;
  if (goodToHaveSkills !== undefined) db.assessments[asmtIndex].goodToHaveSkills = goodToHaveSkills;
  if (skillsExtracted !== undefined) db.assessments[asmtIndex].skillsExtracted = skillsExtracted;
  if (locations !== undefined) db.assessments[asmtIndex].locations = locations;
  if (roundsEnabled !== undefined) db.assessments[asmtIndex].roundsEnabled = roundsEnabled;

  saveDb(db, true);
  res.json(db.assessments[asmtIndex]);
});

// Delete Assessment (Admin Only)
assessmentRouter.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userRoleHeader = req.headers['x-user-role'];
  const userEmailHeader = req.headers['x-user-email'];

  const db = getDb();

  let role = (Array.isArray(userRoleHeader) ? userRoleHeader[0] : userRoleHeader) || '';
  if (!role && userEmailHeader) {
    const emailStr = (Array.isArray(userEmailHeader) ? userEmailHeader[0] : userEmailHeader).toLowerCase().trim();
    const matched = (db.accounts || []).find((acc: any) => acc.email && acc.email.toLowerCase().trim() === emailStr);
    if (matched) {
      role = matched.role;
    }
  }

  if (role && role !== 'Admin') {
    return res.status(403).json({ error: 'Access Denied: Only Administrators are authorized to delete assessments.' });
  }

  db.assessments = db.assessments.filter(a => a.id !== id);
  saveDb(db, true);
  res.json({ success: true });
});
