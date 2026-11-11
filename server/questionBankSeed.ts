/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Question Bank Automatic Seeding Engine.
 * Extracts all 7,600+ questions (5,600 technical + 2,000 coding challenges)
 * from the attached ZIP archive into the database default state on server startup.
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { DbStore } from './types';

export function seedQuestionBankFromZip(db: DbStore): DbStore {
  try {
    if (!db.questionBank) db.questionBank = [];

    // Check if default questions already exist
    const defaultCount = db.questionBank.filter(q => q.source === 'default_bank').length;
    if (defaultCount >= 7000) {
      console.log(`[QUESTION BANK SEED] Default bank already fully seeded (${defaultCount} questions).`);
      return db;
    }

    const zipPath = path.join(process.cwd(), 'public/assets/aistudio/interview_assessment_bank_v2_complete_89662387.zip');
    if (!fs.existsSync(zipPath)) {
      console.warn(`[QUESTION BANK SEED] ZIP archive not found at ${zipPath}`);
      return db;
    }

    console.log('[QUESTION BANK SEED] Automatically extracting all 7,600+ default questions from ZIP archive into database...');

    const pythonScript = `
import zipfile, json

zip_path = "${zipPath.replace(/\\/g, '/')}"
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

    print(json.dumps({'success': True, 'items': questions}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

    const stdout = execSync(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`, {
      maxBuffer: 100 * 1024 * 1024
    }).toString();

    const result = JSON.parse(stdout);
    if (result.items && Array.isArray(result.items)) {
      const now = new Date().toISOString();
      const existingSignatures = new Set(db.questionBank.map(q => `${(q.skill || '').trim().toLowerCase()}:::${(q.question || '').trim().toLowerCase().replace(/\s+/g, ' ')}`));

      let added = 0;
      for (const item of result.items) {
        const sig = `${(item.skill || '').trim().toLowerCase()}:::${(item.question || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
        if (!existingSignatures.has(sig)) {
          existingSignatures.add(sig);
          db.questionBank.push({
            id: item.id || `def-${Date.now()}-${added}`,
            skill: item.skill,
            skillCategory: item.skillCategory,
            subTopic: item.subTopic,
            difficulty: item.difficulty === 'High' ? 'Difficult' : (item.difficulty || 'Moderate'),
            category: item.category || 'Technical',
            question: item.question,
            sampleAnswer: item.sampleAnswer,
            evaluationRubric: item.evaluationRubric,
            createdAt: now,
            updatedAt: now,
            source: 'default_bank'
          });
          added++;
        }
      }

      console.log(`[QUESTION BANK SEED SUCCESS] Seeded ${added} questions into database. Total Question Bank Size: ${db.questionBank.length}`);
    }
  } catch (err) {
    console.error('[QUESTION BANK SEED ERROR]', err);
  }

  return db;
}
