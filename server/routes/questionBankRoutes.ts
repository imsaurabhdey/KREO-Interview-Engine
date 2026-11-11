/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Question Bank Express API Router.
 * Standardized repository endpoints for managing internal technical & coding question bank.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import zlib from 'zlib';
import { getDb, saveDb } from '../db';
import { QuestionBankItem } from '../types';

export const questionBankRouter = Router();

// Helper: Normalize difficulty string
function normalizeDifficulty(val: string): 'Easy' | 'Moderate' | 'Difficult' {
  if (!val) return 'Moderate';
  const clean = val.trim().toLowerCase();
  if (clean.includes('easy')) return 'Easy';
  if (clean.includes('high') || clean.includes('hard') || clean.includes('difficult')) return 'Difficult';
  return 'Moderate';
}

// Helper: Normalize category string
function normalizeCategory(val: string): 'Technical' | 'Coding' | 'HR' | 'Behavioral' {
  if (!val) return 'Technical';
  const clean = val.trim().toLowerCase();
  if (clean.includes('code') || clean.includes('coding') || clean.includes('algorithm')) return 'Coding';
  if (clean.includes('hr') || clean.includes('intro')) return 'HR';
  if (clean.includes('behavior')) return 'Behavioral';
  return 'Technical';
}

// Helper: Generate unique question signature for deduplication
function getQuestionSignature(item: Partial<QuestionBankItem>): string {
  const skill = (item.skill || '').trim().toLowerCase();
  const qText = (item.question || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${skill}:::${qText}`;
}

/**
 * GET /api/question-bank/skills
 * Returns summarized skill taxonomy with total questions and breakdown by difficulty and category.
 */
questionBankRouter.get('/skills', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const bank = db.questionBank || [];

    const skillMap: Record<string, {
      skill: string;
      total: number;
      easy: number;
      moderate: number;
      difficult: number;
      technical: number;
      coding: number;
      category?: string;
    }> = {};

    for (const item of bank) {
      const skillName = item.skill || 'General';
      if (!skillMap[skillName]) {
        skillMap[skillName] = {
          skill: skillName,
          total: 0,
          easy: 0,
          moderate: 0,
          difficult: 0,
          technical: 0,
          coding: 0,
          category: item.skillCategory || 'Development'
        };
      }

      const record = skillMap[skillName];
      record.total++;

      const diff = normalizeDifficulty(item.difficulty);
      if (diff === 'Easy') record.easy++;
      else if (diff === 'Difficult') record.difficult++;
      else record.moderate++;

      const cat = normalizeCategory(item.category);
      if (cat === 'Coding') record.coding++;
      else record.technical++;
    }

    const skillsList = Object.values(skillMap).sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      totalQuestions: bank.length,
      totalSkills: skillsList.length,
      skills: skillsList
    });
  } catch (err) {
    console.error('[QUESTION BANK] Error fetching skill taxonomy:', err);
    res.status(500).json({ error: 'Failed to compute skill taxonomy' });
  }
});

/**
 * GET /api/question-bank/questions
 * Filter & search questions with optional pagination
 */
questionBankRouter.get('/questions', (req: Request, res: Response) => {
  try {
    const db = getDb();
    let bank = db.questionBank || [];

    const { skill, difficulty, category, search, page = '1', limit = '100' } = req.query;

    if (skill && typeof skill === 'string' && skill.trim().toLowerCase() !== 'all') {
      const targetSkill = skill.trim().toLowerCase();
      bank = bank.filter(q => q.skill && q.skill.trim().toLowerCase() === targetSkill);
    }

    if (difficulty && typeof difficulty === 'string' && difficulty !== 'All') {
      const targetDiff = normalizeDifficulty(difficulty);
      bank = bank.filter(q => normalizeDifficulty(q.difficulty) === targetDiff);
    }

    if (category && typeof category === 'string' && category !== 'All') {
      const targetCat = normalizeCategory(category);
      bank = bank.filter(q => normalizeCategory(q.category) === targetCat);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const qStr = search.trim().toLowerCase();
      bank = bank.filter(q => 
        (q.question && q.question.toLowerCase().includes(qStr)) ||
        (q.skill && q.skill.toLowerCase().includes(qStr)) ||
        (q.subTopic && q.subTopic.toLowerCase().includes(qStr)) ||
        (q.sampleAnswer && q.sampleAnswer.toLowerCase().includes(qStr))
      );
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 100;

    const totalCount = bank.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = bank.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      questions: paginatedItems
    });
  } catch (err) {
    console.error('[QUESTION BANK] Error searching questions:', err);
    res.status(500).json({ error: 'Failed to retrieve question bank items' });
  }
});

/**
 * POST /api/question-bank/questions
 * Add single question manually
 */
questionBankRouter.post('/questions', (req: Request, res: Response) => {
  try {
    const { skill, skillCategory, subTopic, difficulty, category, question, sampleAnswer, evaluationRubric, starterCode, testCases } = req.body;

    if (!skill || !skill.trim() || !question || !question.trim()) {
      return res.status(400).json({ error: 'Skill name and Question text are required' });
    }

    const db = getDb();
    if (!db.questionBank) db.questionBank = [];

    const newSignature = getQuestionSignature({ skill, question });
    const existingSignatures = new Set(db.questionBank.map(getQuestionSignature));

    if (existingSignatures.has(newSignature)) {
      return res.status(409).json({ error: 'This question already exists for this skill in the bank' });
    }

    const newItem: QuestionBankItem = {
      id: `qbank-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      skill: skill.trim(),
      skillCategory: skillCategory ? skillCategory.trim() : 'Development',
      subTopic: subTopic ? subTopic.trim() : undefined,
      difficulty: normalizeDifficulty(difficulty),
      category: normalizeCategory(category),
      question: question.trim(),
      sampleAnswer: sampleAnswer ? sampleAnswer.trim() : undefined,
      evaluationRubric: evaluationRubric ? evaluationRubric.trim() : undefined,
      starterCode: starterCode ? starterCode.trim() : undefined,
      testCases: Array.isArray(testCases) ? testCases : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'manual'
    };

    db.questionBank.unshift(newItem);
    saveDb(db, true);

    res.status(201).json({
      success: true,
      question: newItem,
      totalQuestions: db.questionBank.length
    });
  } catch (err) {
    console.error('[QUESTION BANK] Error adding single question:', err);
    res.status(500).json({ error: 'Failed to add question to bank' });
  }
});

/**
 * PUT /api/question-bank/questions/:id
 * Update question item
 */
questionBankRouter.put('/questions/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    if (!db.questionBank) db.questionBank = [];

    const index = db.questionBank.findIndex(q => q.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Question not found in bank' });
    }

    const existing = db.questionBank[index];
    const updated: QuestionBankItem = {
      ...existing,
      skill: req.body.skill ? req.body.skill.trim() : existing.skill,
      skillCategory: req.body.skillCategory !== undefined ? req.body.skillCategory : existing.skillCategory,
      subTopic: req.body.subTopic !== undefined ? req.body.subTopic : existing.subTopic,
      difficulty: req.body.difficulty ? normalizeDifficulty(req.body.difficulty) : existing.difficulty,
      category: req.body.category ? normalizeCategory(req.body.category) : existing.category,
      question: req.body.question ? req.body.question.trim() : existing.question,
      sampleAnswer: req.body.sampleAnswer !== undefined ? req.body.sampleAnswer : existing.sampleAnswer,
      evaluationRubric: req.body.evaluationRubric !== undefined ? req.body.evaluationRubric : existing.evaluationRubric,
      starterCode: req.body.starterCode !== undefined ? req.body.starterCode : existing.starterCode,
      testCases: req.body.testCases !== undefined ? req.body.testCases : existing.testCases,
      updatedAt: new Date().toISOString()
    };

    db.questionBank[index] = updated;
    saveDb(db, true);

    res.json({ success: true, question: updated });
  } catch (err) {
    console.error('[QUESTION BANK] Error updating question:', err);
    res.status(500).json({ error: 'Failed to update question in bank' });
  }
});

/**
 * DELETE /api/question-bank/questions/:id
 * Delete question item
 */
questionBankRouter.delete('/questions/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    if (!db.questionBank) db.questionBank = [];

    const initialLen = db.questionBank.length;
    db.questionBank = db.questionBank.filter(q => q.id !== id);

    if (db.questionBank.length === initialLen) {
      return res.status(404).json({ error: 'Question not found' });
    }

    saveDb(db, true);
    res.json({ success: true, remainingTotal: db.questionBank.length });
  } catch (err) {
    console.error('[QUESTION BANK] Error deleting question:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

/**
 * POST /api/question-bank/import-default
 * Extract and parse the attached default ZIP archive (`interview_assessment_bank_v2_complete_89662387.zip`)
 */
questionBankRouter.post('/import-default', async (req: Request, res: Response) => {
  try {
    const zipRelativePath = 'public/assets/aistudio/interview_assessment_bank_v2_complete_89662387.zip';
    const zipFullPath = path.join(process.cwd(), zipRelativePath);

    if (!fs.existsSync(zipFullPath)) {
      return res.status(404).json({ error: 'Default question bank ZIP archive not found on server.' });
    }

    // Use python helper script or native zip extractor to parse .jsonl files efficiently
    const { exec } = await import('child_process');
    const pythonScript = `
import zipfile, json, sys

zip_path = "${zipFullPath.replace(/\\/g, '/')}"
questions = []

try:
    with zipfile.ZipFile(zip_path, 'r') as z:
        if 'technical_questions_v2.jsonl' in z.namelist():
            with z.open('technical_questions_v2.jsonl') as f:
                for line in f:
                    line = line.decode('utf-8').strip()
                    if not line: continue
                    try:
                        row = json.loads(line)
                        skill = row.get('skill_name') or 'General'
                        q_text = row.get('question_text') or ''
                        if q_text:
                            questions.append({
                                'id': 'def-tech-' + str(row.get('question_id', len(questions))),
                                'skill': skill,
                                'skillCategory': row.get('category', 'Development'),
                                'subTopic': row.get('competency', ''),
                                'difficulty': row.get('difficulty', 'Moderate'),
                                'category': 'Technical',
                                'question': q_text,
                                'sampleAnswer': row.get('expected_evidence', '') or row.get('reference_answer_status', ''),
                                'evaluationRubric': row.get('rubric_id', ''),
                                'source': 'default_bank'
                            })
                    except Exception as e:
                        pass

        if 'coding_challenges_2000_v2.jsonl' in z.namelist():
            with z.open('coding_challenges_2000_v2.jsonl') as f:
                for line in f:
                    line = line.decode('utf-8').strip()
                    if not line: continue
                    try:
                        row = json.loads(line)
                        skill = row.get('track_name') or row.get('language_or_runtime') or 'General'
                        title = row.get('problem_title') or 'Coding Challenge'
                        statement = row.get('problem_statement') or ''
                        q_text = f"**{title}**\\n\\n{statement}" if statement else title
                        if q_text:
                            questions.append({
                                'id': 'def-code-' + str(row.get('coding_question_id', len(questions))),
                                'skill': skill,
                                'skillCategory': 'Software Development',
                                'subTopic': row.get('competency', ''),
                                'difficulty': row.get('difficulty', 'Moderate'),
                                'category': 'Coding',
                                'question': q_text,
                                'sampleAnswer': row.get('input_contract', '') + (' -> ' + row.get('output_contract', '') if row.get('output_contract') else ''),
                                'evaluationRubric': row.get('constraints', ''),
                                'source': 'default_bank'
                            })
                    except Exception as e:
                        pass

    print(json.dumps({'success': True, 'count': len(questions), 'items': questions[:3000]}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

    exec(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error || !stdout) {
        console.error('[ZIP PARSER ERROR]', error, stderr);
        return res.status(500).json({ error: 'Failed to extract default bank archive' });
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          return res.status(500).json({ error: result.error });
        }

        const items: any[] = result.items || [];
        const db = getDb();
        if (!db.questionBank) db.questionBank = [];

        const existingSignatures = new Set(db.questionBank.map(getQuestionSignature));
        let addedCount = 0;

        const now = new Date().toISOString();
        for (const item of items) {
          const sig = getQuestionSignature(item);
          if (!existingSignatures.has(sig)) {
            existingSignatures.add(sig);
            db.questionBank.push({
              id: item.id || `def-${Date.now()}-${addedCount}`,
              skill: item.skill,
              skillCategory: item.skillCategory,
              subTopic: item.subTopic,
              difficulty: normalizeDifficulty(item.difficulty),
              category: normalizeCategory(item.category),
              question: item.question,
              sampleAnswer: item.sampleAnswer,
              evaluationRubric: item.evaluationRubric,
              createdAt: now,
              updatedAt: now,
              source: 'default_bank'
            });
            addedCount++;
          }
        }

        saveDb(db, true);

        return res.json({
          success: true,
          addedCount,
          totalQuestions: db.questionBank.length,
          message: `Successfully ingested ${addedCount} default questions into Question Bank repository.`
        });
      } catch (jsonErr) {
        console.error('[ZIP JSON PARSE ERROR]', jsonErr, stdout.substring(0, 500));
        return res.status(500).json({ error: 'Failed to parse extracted JSON from dataset' });
      }
    });
  } catch (err) {
    console.error('[QUESTION BANK IMPORT ERROR]', err);
    res.status(500).json({ error: 'Failed to process default question bank import' });
  }
});

/**
 * POST /api/question-bank/upload
 * Bulk Upload file endpoint (CSV, JSON, JSONL, DOC, PDF)
 */
questionBankRouter.post('/upload', (req: Request, res: Response) => {
  try {
    const { fileName, fileData, fileType } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'File data content is required' });
    }

    const db = getDb();
    if (!db.questionBank) db.questionBank = [];

    // Decode base64 if passed
    let rawText = fileData;
    if (fileData.includes('base64,')) {
      rawText = Buffer.from(fileData.split('base64,')[1], 'base64').toString('utf-8');
    } else {
      try {
        rawText = Buffer.from(fileData, 'base64').toString('utf-8');
      } catch (e) {
        rawText = fileData;
      }
    }

    const lines = rawText.split(/\r?\n/).filter((l: string) => l.trim());
    if (lines.length === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    const existingSignatures = new Set(db.questionBank.map(getQuestionSignature));
    let addedCount = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let skill = 'General';
      let difficulty: 'Easy' | 'Moderate' | 'Difficult' = 'Moderate';
      let category: 'Technical' | 'Coding' | 'HR' | 'Behavioral' = 'Technical';
      let questionText = '';
      let sampleAns = '';

      // Check if JSON line
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const parsed = JSON.parse(line);
          skill = parsed.skill || parsed.skill_name || parsed.track_name || 'General';
          difficulty = normalizeDifficulty(parsed.difficulty);
          category = normalizeCategory(parsed.category);
          questionText = parsed.question || parsed.question_text || parsed.problem_statement || parsed.text || '';
          sampleAns = parsed.sampleAnswer || parsed.expected_evidence || parsed.answer || '';
        } catch (e) {
          questionText = line;
        }
      } else if (line.includes(',')) {
        // Simple CSV parse
        const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 3) {
          skill = parts[0] || 'General';
          difficulty = normalizeDifficulty(parts[1]);
          questionText = parts.slice(2).join(', ');
        } else {
          questionText = line;
        }
      } else {
        questionText = line;
      }

      if (!questionText || questionText.toLowerCase().includes('question text') || questionText.length < 5) {
        continue; // Skip header or invalid line
      }

      const item: QuestionBankItem = {
        id: `upload-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
        skill,
        difficulty,
        category,
        question: questionText,
        sampleAnswer: sampleAns || undefined,
        createdAt: now,
        updatedAt: now,
        source: 'bulk_import'
      };

      const sig = getQuestionSignature(item);
      if (!existingSignatures.has(sig)) {
        existingSignatures.add(sig);
        db.questionBank.push(item);
        addedCount++;
      }
    }

    saveDb(db, true);

    res.json({
      success: true,
      addedCount,
      totalQuestions: db.questionBank.length,
      message: `Parsed file "${fileName || 'attachment'}". Added ${addedCount} new questions.`
    });
  } catch (err) {
    console.error('[QUESTION BANK UPLOAD ERROR]', err);
    res.status(500).json({ error: 'Failed to process bulk upload file' });
  }
});
