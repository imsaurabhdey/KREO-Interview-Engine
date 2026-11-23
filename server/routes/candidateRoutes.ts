/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise Candidate Ingestion, Resume AI Extraction & Applicant Management Routes.
 * Protected by server-verified recruiter/admin authentication, organization scoping,
 * minimal list projections, and audit logging.
 */

import crypto from 'crypto';
import { Router } from 'express';
import { Type } from '@google/genai';
import { getDb, saveDb } from '../db';
import { Candidate } from '../types';
import { getGeminiClient, generateContentWithFallback, cleanAndParseJSON } from '../gemini';
import { deleteCandidateRecording } from '../s3Storage';
import { sendCandidateEmail } from '../emailService';
import { requireAuth, canAccessOrg, logAuditEvent } from '../authMiddleware';
import { DEV_ZIP_SAMPLE_CANDIDATES } from '../demoFixtures';

export const candidateRouter = Router();

// Require verified Recruiter/Admin session on all candidate management endpoints
candidateRouter.use(requireAuth);

/**
 * Projects a candidate record for collection list views, omitting heavy raw interview
 * transcripts while preserving all summary metrics required by the dashboard.
 */
function projectCandidateSummary(candidate: Candidate) {
  const { feedbackReport, ...rest } = candidate;
  if (!feedbackReport) {
    return rest;
  }

  const { transcripts, ...reportSummary } = feedbackReport;
  return {
    ...rest,
    feedbackReport: {
      ...reportSummary,
      transcripts: [],
      transcriptCount: Array.isArray(transcripts) ? transcripts.length : 0
    }
  };
}

// Collection route: GET candidates scoped to caller's organization (summary projection)
candidateRouter.get('/', (req, res) => {
  const db = getDb();
  const scoped = (db.candidates || [])
    .filter((c) => canAccessOrg(req.authUser!, c.orgName))
    .map(projectCandidateSummary);

  res.json(scoped);
});

// Item route: GET full candidate detail (including transcripts) by ID or Token with audit log
candidateRouter.get('/:idOrToken', (req, res) => {
  const { idOrToken } = req.params;
  const db = getDb();
  const candidate = (db.candidates || []).find(
    (c) => (c.id === idOrToken || c.token === idOrToken) && canAccessOrg(req.authUser!, c.orgName)
  );
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  logAuditEvent('CANDIDATE_DETAIL_READ', req.authUser!, {
    candidateId: candidate.id,
    assessmentId: candidate.assessmentId
  });

  res.json(candidate);
});

// Explicit Check Duplicate Candidate API (scoped to organization)
candidateRouter.post('/check-duplicate', (req, res) => {
  const { email, phone, excludeId } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').trim().replace(/\D/g, '');

  const db = getDb();

  let duplicateByEmail = false;
  let duplicateByPhone = false;
  let matchedCandidate: Candidate | undefined = undefined;

  for (const c of (db.candidates || []).filter((cand) => canAccessOrg(req.authUser!, cand.orgName))) {
    if (excludeId && c.id === excludeId) continue;

    if (cleanEmail && c.email && c.email.trim().toLowerCase() === cleanEmail) {
      duplicateByEmail = true;
      matchedCandidate = c;
    }

    if (cleanPhone && cleanPhone.length >= 7 && c.phone && c.phone !== 'N/A') {
      const cPhoneDigits = c.phone.trim().replace(/\D/g, '');
      if (cPhoneDigits === cleanPhone) {
        duplicateByPhone = true;
        if (!matchedCandidate) matchedCandidate = c;
      }
    }
  }

  if (duplicateByEmail || duplicateByPhone) {
    const fieldDesc = (duplicateByEmail && duplicateByPhone)
      ? 'email and phone number'
      : (duplicateByEmail ? 'email address' : 'phone number');

    return res.json({
      duplicate: true,
      error: `Candidate already exists with this ${fieldDesc}${matchedCandidate ? ` (${matchedCandidate.name})` : ''} in the system.`,
      duplicateField: duplicateByEmail && duplicateByPhone ? 'both' : (duplicateByEmail ? 'email' : 'phone'),
      existingCandidate: matchedCandidate ? { id: matchedCandidate.id, name: matchedCandidate.name } : undefined
    });
  }

  return res.json({ duplicate: false });
});

// Create candidate manually or via direct mapping
candidateRouter.post('/', (req, res) => {
  const { name, email, phone, assessmentId, experience, location, skillsExtracted } = req.body;
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').trim().replace(/\D/g, '');

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const db = getDb();
  const orgCandidates = (db.candidates || []).filter((c) => canAccessOrg(req.authUser!, c.orgName));

  // Enforce duplicate candidate check against existing email and phone number within org
  const existingCandidateByEmail = orgCandidates.find(
    (c) => c.email && c.email.trim().toLowerCase() === cleanEmail
  );

  const existingCandidateByPhone = cleanPhone && cleanPhone.length >= 7
    ? orgCandidates.find(
        (c) => c.phone && c.phone !== 'N/A' && c.phone.trim().replace(/\D/g, '') === cleanPhone
      )
    : undefined;

  if (existingCandidateByEmail || existingCandidateByPhone) {
    const matchReason = (existingCandidateByEmail && existingCandidateByPhone)
      ? 'email address and phone number'
      : (existingCandidateByEmail ? 'email address' : 'phone number');
    const matched = existingCandidateByEmail || existingCandidateByPhone;

    return res.status(409).json({
      error: `Candidate already exists with this ${matchReason}${matched?.name ? ` (${matched.name})` : ''} in the system.`,
      duplicate: true,
      duplicateField: existingCandidateByEmail ? 'email' : 'phone',
      existingCandidate: matched ? { id: matched.id, name: matched.name } : undefined
    });
  }

  const orgAssessments = (db.assessments || []).filter((a) => canAccessOrg(req.authUser!, a.orgName));
  let asmtId = assessmentId;
  if (asmtId && !orgAssessments.some((a) => a.id === asmtId)) {
    return res.status(404).json({ error: 'Selected assessment not found in your organization.' });
  }
  if (!asmtId && orgAssessments.length > 0) {
    asmtId = orgAssessments[0].id;
  }
  if (!asmtId) {
    return res.status(400).json({ error: 'No assessment found to assign this candidate to. Please create an assessment first.' });
  }

  const tokenTtlDays = Math.max(1, Number(process.env.INVITE_TOKEN_TTL_DAYS || 7));
  const tokenExpiresAt = new Date(Date.now() + tokenTtlDays * 24 * 60 * 60 * 1000).toISOString();
  const token = `tok-${crypto.randomBytes(16).toString('hex')}`;
  const newCandidate: Candidate = {
    id: `cand-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    name: cleanName,
    email: cleanEmail,
    phone: phone || 'N/A',
    assessmentId: asmtId,
    status: 'Pending',
    token,
    tokenExpiresAt,
    experience: experience || 'Not specified',
    location: location || 'Remote',
    skillsExtracted: skillsExtracted || [],
    createdAt: new Date().toISOString(),
    createdByEmail: req.authUser!.email,
    createdByName: req.authUser!.name,
    orgName: req.authUser!.orgName
  };

  db.candidates.push(newCandidate);
  saveDb(db, true);

  logAuditEvent('CANDIDATE_CREATE', req.authUser!, {
    candidateId: newCandidate.id,
    assessmentId: newCandidate.assessmentId
  });

  res.json(newCandidate);
});

// Update candidate status or selection decision
candidateRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, selectionStatus, feedbackReport, aiAssessmentScore } = req.body;
  const db = getDb();
  const candidate = db.candidates.find((c) => c.id === id && canAccessOrg(req.authUser!, c.orgName));
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  if (status !== undefined) {
    candidate.status = status;
    if (status === 'Candidate Invited') {
      const asmt = db.assessments.find((a) => a.id === candidate.assessmentId);
      const startLink = `${process.env.APP_URL || 'http://localhost:3000'}/?token=${candidate.token}`;
      sendCandidateEmail(candidate.email, candidate.name, 'INVITATION', {
        assessmentTitle: asmt?.title,
        startLink
      }).catch((err) => console.error('Async candidate email invite error:', err));
    }
  }

  if (selectionStatus !== undefined) {
    candidate.selectionStatus = selectionStatus;
  }

  if (feedbackReport !== undefined && typeof feedbackReport === 'object') {
    candidate.feedbackReport = {
      ...(candidate.feedbackReport || {}),
      ...feedbackReport,
      transcripts: Array.isArray(feedbackReport.transcripts) && feedbackReport.transcripts.length > 0
        ? feedbackReport.transcripts
        : (candidate.feedbackReport?.transcripts || [])
    };
  }

  if (aiAssessmentScore !== undefined) {
    candidate.aiAssessmentScore = aiAssessmentScore;
  }

  saveDb(db, true);

  logAuditEvent('CANDIDATE_UPDATE', req.authUser!, {
    candidateId: candidate.id,
    status: candidate.status,
    selectionStatus: candidate.selectionStatus
  });

  res.json({ success: true, candidate });
});

// Record human recruiter review decision & notes (Human-in-the-Loop governance)
const ALLOWED_HUMAN_DECISIONS = new Set(['Shortlisted', 'On Hold', 'Rejected', 'Hired']);
candidateRouter.put('/:id/human-review', (req, res) => {
  const { id } = req.params;
  const { decision, notes } = req.body || {};

  if (!decision || !ALLOWED_HUMAN_DECISIONS.has(String(decision))) {
    return res.status(400).json({
      error: 'Valid decision is required (Shortlisted, On Hold, Rejected, or Hired).'
    });
  }

  const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 2000) : '';
  const db = getDb();
  const candidate = db.candidates.find((c) => c.id === id && canAccessOrg(req.authUser!, c.orgName));
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  const typedDecision = decision as 'Shortlisted' | 'On Hold' | 'Rejected' | 'Hired';
  candidate.humanReview = {
    decision: typedDecision,
    notes: cleanNotes,
    reviewedByEmail: req.authUser!.email,
    reviewedByName: req.authUser!.name,
    reviewedAt: new Date().toISOString()
  };

  // Sync top-level selectionStatus with human recruiter decision
  if (typedDecision === 'Shortlisted' || typedDecision === 'Hired') {
    candidate.selectionStatus = 'Selected';
  } else if (typedDecision === 'Rejected') {
    candidate.selectionStatus = 'Not Selected';
  } else {
    candidate.selectionStatus = 'Processing';
  }

  saveDb(db, true);

  logAuditEvent('CANDIDATE_HUMAN_REVIEW', req.authUser!, {
    candidateId: candidate.id,
    decision: typedDecision
  });

  res.json({ success: true, candidate });
});

// Rotate & extend invite link (+7 days default) for non-completed candidates
candidateRouter.post('/:id/reissue-invite', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const candidate = db.candidates.find((c) => c.id === id && canAccessOrg(req.authUser!, c.orgName));
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  if (candidate.status === 'Completed' || candidate.status === 'Suspended') {
    return res.status(409).json({
      error: `Cannot re-issue invite link because this interview is already finalized (${candidate.status}).`
    });
  }

  const tokenTtlDays = Math.max(1, Number(process.env.INVITE_TOKEN_TTL_DAYS || 7));
  candidate.token = `tok-${crypto.randomBytes(16).toString('hex')}`;
  candidate.tokenExpiresAt = new Date(Date.now() + tokenTtlDays * 24 * 60 * 60 * 1000).toISOString();
  candidate.status = 'Candidate Invited';

  saveDb(db, true);

  const asmt = db.assessments.find((a) => a.id === candidate.assessmentId);
  const startLink = `${process.env.APP_URL || 'http://localhost:3000'}/?token=${candidate.token}`;

  if (req.body?.sendEmail !== false) {
    sendCandidateEmail(candidate.email, candidate.name, 'INVITATION', {
      assessmentTitle: asmt?.title,
      startLink
    }).catch((err) => console.error('Async re-issued invite email error:', err));
  }

  logAuditEvent('CANDIDATE_REISSUE_INVITE', req.authUser!, {
    candidateId: candidate.id,
    tokenExpiresAt: candidate.tokenExpiresAt
  });

  res.json({
    success: true,
    candidate,
    startLink,
    tokenExpiresAt: candidate.tokenExpiresAt
  });
});

// Delete candidate & linked recordings
candidateRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const candidate = db.candidates.find((c) => c.id === id && canAccessOrg(req.authUser!, c.orgName));
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  await deleteCandidateRecording(candidate.token, candidate.name);

  db.candidates = db.candidates.filter((c) => c.id !== id);
  saveDb(db, true);

  logAuditEvent('CANDIDATE_DELETE', req.authUser!, { candidateId: id });
  res.json({ success: true });
});

// AI Candidate Resume Parsing and Bulk CSV/ZIP Extraction Endpoint
candidateRouter.post('/extract-file', async (req, res) => {
  const { fileName, fileType, fileData, files, assessmentId } = req.body;
  const db = getDb();

  const filesList = files && Array.isArray(files)
    ? files
    : (fileName && fileData ? [{ name: fileName, data: fileData, type: fileType }] : []);

  if (filesList.length === 0) {
    return res.status(400).json({ error: 'No file data parsed.' });
  }

  let assessmentDetails = '';
  if (assessmentId) {
    const asmt = db.assessments.find((a) => a.id === assessmentId && canAccessOrg(req.authUser!, a.orgName));
    if (asmt) {
      assessmentDetails = `
      Compare the candidate precisely against these target job requirements:
      - Title: "${asmt.title}"
      - Required Experience Level: "${asmt.experienceRequired}"
      - Mandatory Skills Required: ${(asmt.mandatorySkills || asmt.skillsExtracted || []).join(', ')}
      - Good-to-have Skills Preferred: ${(asmt.goodToHaveSkills || []).join(', ')}
      - Full Job Description parameters: ${asmt.jdText}
      `;
    }
  }

  const results: any[] = [];
  const ai = getGeminiClient();

  for (const f of filesList) {
    const fn_lower = f.name.toLowerCase();
    let baseName = f.name.replace(/\.[^/.]+$/, '').replace(/_|-/g, ' ');

    let extractedExperience = '2-4 Years';
    const filenameExpMatch = f.name.match(/\[(\d+)\s*y(?:(?:ears?)?\s*\d+\s*m(?:onths?)?)?\]/i);
    if (filenameExpMatch && filenameExpMatch[1]) {
      extractedExperience = `${filenameExpMatch[1]} Years`;
    }

    baseName = baseName.replace(/\[.*?\]|\(.*?\)/g, ' ').trim();
    baseName = baseName.replace(/\bnaukri\b/gi, '').trim();
    baseName = baseName.replace(/\b(resume|cv|reume|resum|evaluation|profile|attachment|portfolio|final|doc|docx|pdf)\b/gi, '').trim();
    baseName = baseName.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
    if (!baseName) {
      baseName = 'Applicant Profile';
    }

    const cleanEmailName = baseName.toLowerCase().replace(/\s+/g, '');
    const fallbackCandidate = {
      name: baseName,
      email: `${cleanEmailName || 'candidate'}@org-applicants.net`,
      phone: '+91 9' + Math.floor(100000000 + Math.random() * 900000000),
      experience: extractedExperience,
      skills: ['React', 'Node.js', 'TypeScript', 'Tailwind CSS'],
      location: 'Bengaluru, India'
    };

    try {
      if (f.data) {
        const rawText = Buffer.from(f.data, 'base64').toString('utf-8').replace(/[^\x20-\x7E\s]/g, ' ');

        const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/i;
        const emailMatch = rawText.match(emailRegex);
        if (emailMatch) {
          fallbackCandidate.email = emailMatch[0].toLowerCase();
        }

        const phoneRegexIndian = /\b(?:\+91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}\b/;
        const phoneMatch = rawText.match(phoneRegexIndian);
        if (phoneMatch) {
          fallbackCandidate.phone = phoneMatch[0];
        }

        const knownSkills = [
          'React', 'Node.js', 'TypeScript', 'Tailwind CSS', 'JavaScript', 'HTML5', 'CSS3', 'Vue.js', 'Angular',
          'Next.js', 'Express.js', 'Python', 'Django', 'Flask', 'FastAPI', 'Java', 'Docker', 'Kubernetes', 'AWS',
          'SQL', 'PostgreSQL', 'MongoDB', 'C++', 'Go', 'Rust', 'PHP', 'Laravel', 'D3.js', 'Redux', 'System Design'
        ];
        const detectedSkills: string[] = [];
        for (const skill of knownSkills) {
          const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`, 'i');
          if (regex.test(rawText)) {
            detectedSkills.push(skill);
          }
        }
        if (detectedSkills.length > 0) {
          fallbackCandidate.skills = detectedSkills.slice(0, 8);
        }

        const cities = ['Bengaluru', 'Bangalore', 'Delhi', 'Noida', 'Gurugram', 'Gurgaon', 'Mumbai', 'Pune', 'Chennai', 'Hyderabad', 'Kolkata'];
        for (const loc of cities) {
          const regex = new RegExp(`\\b${loc}\\b`, 'i');
          if (regex.test(rawText)) {
            fallbackCandidate.location = loc === 'Bangalore' ? 'Bengaluru, India' : `${loc}, India`;
            break;
          }
        }

        const expTextMatch = rawText.match(/\b(?:(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:exp|experience))\b/i);
        if (expTextMatch && expTextMatch[1]) {
          fallbackCandidate.experience = `${expTextMatch[1]} Years`;
        }
      }
    } catch (parseErr) {
      console.warn('[OFFLINE EXTRACT] Failed parsing base64 stream as text:', parseErr);
    }

    // CSV format parsing
    if (fn_lower.endsWith('.csv') || f.type?.includes('csv') || fileType === 'csv') {
      try {
        const decodedCsv = Buffer.from(f.data, 'base64').toString('utf-8');
        const lines = decodedCsv.split('\n').map((l: string) => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          for (let i = 1; i < lines.length; i++) {
            const rowParts = lines[i].split(',').map((v: string) => v.trim().replace(/"/g, ''));
            if (rowParts.length >= 2) {
              const candName = rowParts[0] || `Candidate ${i}`;
              const candEmail = rowParts[1] || `candidate${i}@gmail.com`;
              const candPhone = rowParts[2] || '+91 9999999999';
              const candExp = rowParts[3] || '2-4 Years';
              const candSkills = rowParts[4] ? rowParts[4].split(';').map((s: string) => s.trim()) : ['React', 'TypeScript'];
              const candLoc = rowParts[5] || 'Remote (India)';

              results.push({
                name: candName,
                email: candEmail,
                phone: candPhone,
                experience: candExp,
                skills: candSkills,
                location: candLoc
              });
            }
          }
          continue;
        }
      } catch (err) {
        console.error('Error parsing CSV plain text:', err);
      }
    }

    // ZIP archives: never silently fabricate candidates in production
    if (fn_lower.endsWith('.zip') || f.type?.includes('zip') || fileType === 'zip') {
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          error: 'Bulk ZIP resume extraction is not enabled in production. Please upload individual PDF/DOCX resumes or a CSV candidate roster.'
        });
      }
      console.warn('[DEV FIXTURE] Using development-only sample candidates for ZIP upload simulation.');
      for (const sample of DEV_ZIP_SAMPLE_CANDIDATES) {
        results.push({ ...sample });
      }
      continue;
    }

    // Call Gemini for PDF/Word inline extraction if available
    let parsedWithAI = false;
    if (ai) {
      try {
        const mimeToUse = f.type || (f.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
        console.log('[GEMINI] Processing applicant resume using dynamic model routing helper');
        const response = await generateContentWithFallback(ai, {
          contents: {
            parts: [
              {
                inlineData: {
                  data: f.data,
                  mimeType: mimeToUse
                }
              },
              {
                text: `Analyze the attached candidate resume document.
                Extract and list the key profile points in structured format.
                ${assessmentDetails ? assessmentDetails : 'Compare the profile with general industry expectations.'}

                Return a JSON object containing profile attributes: name, email, phone, experience, skills, location.`
              }
            ]
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                experience: { type: Type.STRING },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                location: { type: Type.STRING }
              },
              required: ['name', 'email']
            }
          }
        });

        if (response.text) {
          const parsed = cleanAndParseJSON(response.text);
          results.push({
            name: parsed.name || fallbackCandidate.name,
            email: parsed.email || fallbackCandidate.email,
            phone: parsed.phone || fallbackCandidate.phone,
            experience: parsed.experience || fallbackCandidate.experience,
            skills: parsed.skills || fallbackCandidate.skills,
            location: parsed.location || fallbackCandidate.location
          });
          parsedWithAI = true;
        }
      } catch (aiErr) {
        console.warn('[GEMINI] File extract failure, using custom fallback parser', aiErr);
      }
    }

    if (!parsedWithAI) {
      results.push(fallbackCandidate);
    }
  }

  res.json({ success: true, candidates: results });
});
