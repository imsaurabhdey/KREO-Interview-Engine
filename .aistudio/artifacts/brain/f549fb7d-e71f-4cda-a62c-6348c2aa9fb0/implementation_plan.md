# Implementation Plan - Admin-Only Internal Question Bank Repository

Build a centralized, **Admin-only Question Bank Repository** for IRIS AI. The Question Bank is restricted exclusively to Administrators (hidden from standard recruiters), and persists all imported and created questions directly into the database. Every import adds incrementally to our growing internal repository—starting with an initial import of the provided ZIP dataset (1,000+ questions) and expanding as admins add questions manually or via bulk files (CSV, ZIP, DOC, PDF).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following revisions incorporate your specific requirements:

- **Confirmed Decision 1 (Admin Role Access Control)**: The **"Question Bank"** navigation tab and management screens are visible and accessible **ONLY to Admin users** (`role === 'admin'`). Standard recruiters will not see the Question Bank tab, ensuring internal question curation is strictly administrative.
- **Confirmed Decision 2 (Permanent Database Persistence & Accumulation)**: All imported questions are saved permanently into the application's central database (`server/db.ts` and Firestore `questionBank` collection). Every bulk import or individual addition appends incrementally to build a rich, internal repository.
- **Confirmed Decision 3 (Initial Repository Seeding)**: Upon clicking **"Import Default Bank"** (or automatically if empty), the database extracts and ingests the full default ZIP dataset (`technical_questions_v2.csv`, `coding_challenges_2000_v2.csv`, `skill_taxonomy_56_v2.csv`) as the foundational baseline repository.
- **Confirmed Decision 4 (Bulk Upload Auto-Parsing)**: Admins can upload additional CSV, ZIP, DOC, PDF, and JSON files at any time to continuously grow the question repository. Parsed questions are automatically categorized by skill and tagged with difficulty levels (`Easy`, `Moderate`, `Difficult`).
- **Confirmed Decision 5 (AI Coexistence)**: Real-time AI question generation remains active during this phase, ensuring zero disruption to existing assessment creation workflows.

---

## 1. Overview & Core Concept

- **What It Does**: Provides an internal enterprise Question Bank repository accessible exclusively to Administrators. Admins can view and filter questions categorized under expandable Skill headers, search by sub-topics or keywords, view code test cases and rubrics, add single questions, delete/edit questions, and import bulk question files.
- **Target Audience**: System Administrators (`role === 'admin'`).
- **Key Value**: Establishes a proprietary, growing internal repository of vetted technical and coding questions, preparing IRIS for zero-token assessment generation while keeping content management strictly controlled by admins.

---

## 2. User Experience & Visual Design

### Key User Flows (Admin Only)

1. **Role-Based Top Bar Access**:
   - When an **Admin** logs in, the Recruiter Portal top bar displays the **"Question Bank"** navigation tab alongside Assessments, Candidates, and Settings.
   - For **Standard Recruiters**, the Question Bank tab is completely hidden.
2. **Explore Question Repository**:
   - Display expandable skill headers showing total accumulated questions (e.g., `Python (42)`, `System Design (28)`, `React (35)`).
   - Real-time search across questions, skill names, and tags.
   - Filter pills for difficulty (`All`, `Easy`, `Moderate`, `Difficult`) and category (`Technical`, `Coding`).
3. **Seed Baseline Repository**:
   - Admin clicks **"Import Default Bank"** to extract and ingest the attached baseline ZIP archive into the central database.
   - The repository immediately populates with over 1,000 structured technical and coding questions mapped across 56 skill domains.
4. **Incremental Repository Additions**:
   - **Bulk Upload**: Admin uploads new files (.csv, .zip, .pdf, .doc, .json). Questions are auto-parsed, deduplicated against existing database entries, and appended to the repository.
   - **Manual Addition**: Admin adds individual questions with skill selection, difficulty tag, rubric/sample answer, and test cases.
5. **Manage Existing Questions**:
   - Expand skill accordions to view question details, test cases, and rubrics. Edit or delete individual questions with instant database persistence.

### Visual Identity & Theme

- **Aesthetic Direction**: High-density Admin Dashboard following IRIS design tokens (`bg-slate-900`/`bg-white`, crisp typography, subtle 1px border dividers).
- **Color Palette**:
  - `Canvas`: Off-white `#F8FAFC` / Dark `#0F172A`
  - `Badges`: Emerald `#10B981` (Easy), Amber `#F59E0B` (Moderate), Crimson `#EF4444` (Difficult)
  - `Admin Accent`: Indigo `#6366F1` / Violet `#8B5CF6`
- **Typography**: Display titles in `Plus Jakarta Sans`, question counters and tabular figures in `tabular-nums font-mono`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Admin Role Safeguards & Server API Security**:
  - *Chosen Approach*: Enforce role checks both on client navigation rendering (`user.role === 'admin'`) and server-side route middleware (`/api/question-bank/*`).
  - *Why*: Prevents non-admin recruiters from viewing or modifying internal question bank content.
- **Decision 2: Deduplication & Incremental Storage**:
  - *Chosen Approach*: Generate a unique signature string for each question (based on normalized skill + question text) during import to prevent duplicate entries while allowing new unique questions to accumulate.
  - *Why*: Ensures the question bank grows cleanly without repeating questions across multiple bulk uploads.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       IRIS Recruiter Portal (React UI)                      │
│                                                                             │
│  Top Navigation (Conditioned on User Role):                                 │
│  - Standard Recruiter: [Assessments]  [Candidates]  [Settings]              │
│  - Admin User:         [Assessments]  [Candidates]  [Question Bank] [Settings]
│                                                          │                  │
│                                                          ▼                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ QuestionBankManager Component (Admin Only)                            │  │
│  │ - Repository Stats (Total Questions, Skill Count, Difficulty Split)   │  │
│  │ - Search Bar & Difficulty Filters                                     │  │
│  │ - Skill Taxonomy Accordion (Expand / Collapse)                        │  │
│  │ - Actions: [Import Default Bank] [Bulk Upload File] [Add Question]     │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Express Backend API                                │
│  Middleware: verifyAdminRole                                                │
│                                                                             │
│  GET    /api/question-bank/questions     (Fetch repository questions)     │
│  POST   /api/question-bank/questions     (Add single question)            │
│  PUT    /api/question-bank/questions/:id (Update question)              │
│  DELETE /api/question-bank/questions/:id (Delete question)              │
│  POST   /api/question-bank/import-default (Ingest default ZIP dataset)     │
│  POST   /api/question-bank/upload         (Incremental bulk file upload)  │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Database Repository (server/db.ts)                        │
│                                                                             │
│  - JSON Storage & Firestore Sync: 'questionBank' collection                 │
│  - Deduplication Index: Map<QuestionSignature, QuestionBankItem>            │
│  - Baseline Asset: public/assets/aistudio/interview_assessment_bank_v2...   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model (`QuestionBankItem`)

```typescript
interface QuestionBankItem {
  id: string;
  skill: string;          // e.g. "Python", "React", "System Design"
  skillCategory?: string;  // e.g. "Backend Development", "Frontend"
  subTopic?: string;
  difficulty: 'Easy' | 'Moderate' | 'Difficult';
  category: 'Technical' | 'Coding' | 'Behavioral';
  question: string;
  sampleAnswer?: string;
  evaluationRubric?: string;
  codeSnippet?: string;
  starterCode?: string;
  testCases?: Array<{ input: string; expectedOutput: string }>;
  createdAt: string;
  updatedAt: string;
  source: 'default_bank' | 'manual' | 'bulk_import';
}
```

---

## Verification & Test Plan

1. **Role Visibility Verification**:
   - Log in as standard Recruiter: verify **"Question Bank"** tab is hidden.
   - Log in as Admin: verify **"Question Bank"** tab is visible and fully functional.
2. **Default Bank Ingestion**:
   - Click "Import Default Bank" and verify that all questions from the ZIP dataset are saved to the database repository and displayed under skill accordions.
3. **Incremental Ingestion & Deduplication**:
   - Perform a bulk file upload and add single questions manually. Verify that new items append to the existing database without clearing previously stored questions.
4. **CRUD Actions**:
   - Edit and delete questions; verify updates persist across page reloads and server restarts.
5. **Compilation & Syntax**:
   - Run `compile_applet` and `lint_applet` to confirm zero build or lint errors.
