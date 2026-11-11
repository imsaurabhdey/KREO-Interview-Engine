# KREO RECRUITER PORTAL & AI INTERVIEW SUITE
## Comprehensive Enterprise Master Documentation & Engineering Specification

---

## PART I: LAYMAN'S GUIDE TO KREO (For Founders & Product Leaders)

### 1. What is Kreo?
Kreo is an intelligent, enterprise-grade AI recruitment platform designed to automate the hiring pipeline from end to end. It eliminates manual overhead by automating job requisition creation, intelligent question selection, proctored candidate interviewing, live code execution, and automated AI scoring.

### 2. Step-by-Step Feature & Button Walkthrough

#### A. The Login & Authentication Portal
- **What you see**: A secure login card with email and password fields.
- **What happens behind the scenes**: When you enter your credentials (e.g., `saurabh.dey@irisoftware.com`), the system checks the encrypted database. Passwords are securely locked using SHA-256 hashing so no one can view raw credentials. 
- **Multi-User Sync**: Any team member or recruiter you create can log in. They share the same centralized database, ensuring all requisition data and candidate pipelines are synchronized across devices in real-time.

#### B. The Recruiter Dashboard & Workspace
- **What you see**: A clean navigation bar featuring the **Kreo** brand, Requisitions tab, Candidate Pipeline, Question Bank, and Analytics.
- **Key Sections**:
  - **Requisitions**: View, create, and publish job descriptions.
  - **Candidates**: Track candidate statuses (Pending, In Progress, Completed), view fitment percentages, coding scores, proctoring integrity, and communication ratings.
  - **Question Bank**: Explore thousands of pre-loaded technical and coding questions.

#### C. Creating an Assessment (Requisition Builder)
- **What you do**: Click "Create Requisition", enter the Job Title (e.g., *Senior React Engineer*), paste the Job Description (JD), and select required skills.
- **What happens**: 
  - Instead of waiting for expensive AI generation on every click, the system instantly scans your **7,600+ centralized question bank**.
  - It uses a hybrid semantic search engine combining **Google Gemini Vector Embeddings (`gemini-embedding-001`)** with **Cosine Similarity** and rule-based fallback maps to pick questions proportional to required skills.
  - It arranges questions in adaptive difficulty order (Easy → Moderate → Difficult).
  - **Cost & Speed**: High-speed in-memory vector retrieval backed by persistent database storage.

#### D. Candidate Interview & Proctoring Experience
- **What the candidate experiences**: 
  - Opens a secure assessment link.
  - Answers technical questions and solves coding challenges in a live IDE with test cases and multi-language support (JavaScript, Python, SQL, etc.).
  - **Proctoring**: Webcam and tab-switch monitoring ensure exam integrity.
- **What happens upon completion**: The system evaluates candidate code and text responses against expert reference rubrics, producing a comprehensive scorecard (Fitment %, Coding Score, Proctoring Integrity, Communication).

---

## PART II: TECHNICAL ARCHITECTURE & ENGINEERING SPECIFICATION (For Developers & Enterprise Teams)

### 1. System Architecture & Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express.js, TypeScript (`server.ts`) listening on port `3000`.
- **Database & Persistence**: Local atomic JSON file (`db.json`) with automated asynchronous replication to Google Cloud Firestore (`firebase-applet-config.json`).
- **AI & Inference Engines**: Google GenAI SDK (`@google/genai`) for text generation and **`gemini-embedding-001`** for vector embedding generation, backed by a robust **Groq High-Speed Inference & Fallback Engine** (`server/groq.ts`).

---

### 2. Hybrid Vector Retrieval & Semantic Clustering Engine (`server/embeddingService.ts` & `server/questionGenerator.ts`)
Rather than relying on external vector databases (Pinecone, Qdrant, Weaviate), Kreo implements a **self-hosted hybrid vector retrieval architecture**:
- **Vector Generation**: Uses Google's state-of-the-art **`gemini-embedding-001`** model to generate high-dimensional vector embeddings for skills and job requirements.
- **In-Memory Cosine Similarity**: Computes mathematical cosine similarity between skill query vectors and question vectors directly in Node.js memory.
- **Zero External Vector Infrastructure**: All vectors and question metadata are permanently stored in the database (`db.json` / Cloud Firestore). Nothing is volatile or temporary.
- **Hybrid Fallback**: If embedding generation is offline or rate-limited, it automatically falls back to curated rule-based semantic skill relationship maps (`synonymsMap`).

---

### 3. Granular Size Limits, Payloads, & Constraints

| Component / File Type | Size / Payload Limit | Technical Enforcement |
| :--- | :--- | :--- |
| **Express HTTP Request Payload** | **50 MB max** | `express.json({ limit: '50mb' })` and `express.urlencoded({ limit: '50mb', extended: true })` in `server.ts`. Supports large base64 resume payloads, candidate transcripts, and video metadata. |
| **Question Bank ZIP Archive** | **~1.5 MB compressed** | Bundled at `public/assets/aistudio/interview_assessment_bank_v2_complete_89662387.zip`. Extracts into **7,600+ default questions** (~15 MB in JSON memory). |
| **Video & Audio Recordings** | **Browser MediaRecorder API** | Recorded via candidate webcam/mic streams, chunked in WebM/MP4 format, transmitted over TLS, and stored in server storage (`/recordings`) with automated retention cleanup (`runRecordingsCleanup`). |
| **AI Embedding Limits (`gemini-embedding-001`)** | **100 RPM, 30k TPM, 1,000 RPD (Free Tier)** | Cached in persistent database; requires only 1 embedding call per requisition. Paid tier: $0.15 per 1M input tokens. |

---

### 4. Encryption & Security Standards

#### A. Password & Credential Security (At Rest)
- **Algorithm**: **SHA-256 Cryptographic Hashing**
- **Implementation (`server/db.ts`)**:
  ```typescript
  export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
  ```
- **Guarantee**: Passwords are never stored in plain text anywhere in the database or logs.

#### B. Transport Layer Security (In Transit)
- **Protocol**: **HTTPS / TLS 1.3**
- **Implementation**: Enforced by the Google Cloud Run / AI Studio hosting infrastructure. All API communication, JSON payloads, and media streams are encrypted end-to-end in transit.

#### C. Database Storage Security
- **Local Storage**: `db.json` stored in the secure container workspace.
- **Cloud Firestore**: Secured via `firestore.rules` and authenticated Firestore SDK connections (`firebase-applet-config.json`).

---

### 5. AI Inference, Token Economics, & Groq Fallback

#### A. Hybrid Vector Question Bank Mapping (Primary Path)
- **Operation**: Assessment creation generates an embedding for requested skills using `gemini-embedding-001` and evaluates questions using in-memory cosine similarity combined with rule-based keyword scoring.
- **Token Cost**: Minimal (1 API call per requisition), well within free-tier limits (1,000 requests/day).
- **Latency**: $< 100\text{ milliseconds}$.

#### B. Groq Multi-Tier Fallback Inference Engine (`server/groq.ts`)
- **Purpose**: High-speed, generous rate-limit backup when primary Gemini models face quotas, HTTP 429 rate limits, or latency.
- **Model Priority (`getOptimalGroqModels`)**:
  1. `llama-3.3-70b-versatile` (Highest reasoning quality & JSON precision, 128k context window)
  2. `llama-3.1-8b-instant` (Highest free-tier RPM/TPM allowance, ultra-fast 800+ tok/s)
  3. `mixtral-8x7b-32768` (MoE high-capacity backup)
- **Cooldowns**: 15-second automatic cooldown (`groqModelCooldowns`) per model on HTTP 429 errors.

---

### 6. API Route Map

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/login` | POST | Recruiter authentication (SHA-256 verification) |
| `/api/assessments` | GET/POST | List and create job requisitions & assessments |
| `/api/assessments/extract-skills` | POST | Extract granular technical skills from JD text |
| `/api/assessments/generate-from-jd` | POST | Generate/map assessment questions from Question Bank |
| `/api/candidates` | GET/POST | Manage candidate pipelines and assessment invitations |
| `/api/interviews/:id` | GET/POST | Handle live candidate interview sessions and submissions |
| `/api/question-bank` | GET/POST | Search, filter, and manage centralized question library |

---

### 7. Summary & Handover Checklist for Engineering Teams
1. **Environment Variables**: Configure `GEMINI_API_KEY` and `GROQ_API_KEY` in `.env`.
2. **Database State**: `db.json` automatically initializes seeded accounts and the 7,600+ question bank on first boot.
3. **Build & Run**: Run `npm run build` or `npm run dev` to start the Express + Vite server on port 3000.
