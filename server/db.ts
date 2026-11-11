/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Database Persistence & Cloud Firestore Synchronization Layer.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore/lite';
import { seedQuestionBankFromZip } from './questionBankSeed';
import { mergeDuplicateQuestionsInBank } from './questionGenerator';
import { DbStore, UserAccount, Assessment, Candidate } from './types';
import bcrypt from 'bcryptjs';

export const DB_PATH = path.join(process.cwd(), 'db.json');

/**
 * Validates whether a candidate record is a synthetic test artifact.
 */
export function isTestCandidate(cand: any): boolean {
  if (!cand) return false;
  const name = (cand.name || '').toLowerCase();
  const email = (cand.email || '').toLowerCase();
  const id = (cand.id || '').toLowerCase();
  
  const seedIds = ['cand-amit', 'cand-rahul', 'cand-priya', 'cand-vikram'];
  if (seedIds.includes(id)) {
    return true;
  }
  
  if (name.includes('test user') || email.includes('test_user_load_')) {
    return true;
  }
  
  return false;
}

/**
 * Enterprise Bcrypt Password Hashing with Salt and Work Factor (OWASP Compliant).
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/**
 * Verifies password against bcrypt hash or legacy SHA-256 fallback.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2s$')) {
    return bcrypt.compareSync(password, storedHash);
  }
  // Legacy SHA-256 fallback comparison
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
  return legacyHash === storedHash;
}

// Global in-memory DB cache
let inMemoryDb: DbStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let nextWriteTimeout: NodeJS.Timeout | null = null;

// Initialize Firebase Firestore connection for durable cloud-scale persistence
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseDb: any = null;

if (fs.existsSync(configPath)) {
  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const firebaseApp = initializeApp(configData);
    firebaseDb = getFirestore(firebaseApp, configData.firestoreDatabaseId);
    console.log('[FIREBASE] Firestore initialized successfully on server-side.');
  } catch (err) {
    console.error('[FIREBASE] Error initializing firebase on server', err);
  }
}

/**
 * Loads database state from local JSON cache or initial seed accounts/assessments.
 */
export function loadDb(): DbStore {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      
      if (!parsed.accounts) {
        parsed.accounts = [];
      }
      if (!parsed.questionBank) {
        parsed.questionBank = [];
      }
      
      const hasSaurabh = parsed.accounts.some((acc: any) => acc.email.toLowerCase() === 'saurabh.dey@irisoftware.com');
      if (!hasSaurabh) {
        parsed.accounts.push({
          id: 'usr-saurabh',
          name: 'Saurabh Dey',
          email: 'saurabh.dey@irisoftware.com',
          passwordHash: hashPassword('saurabh$123%'),
          role: 'Admin',
          orgName: 'Kreo Software',
          createdAt: new Date().toISOString()
        });
      }

      const hasRecruiter = parsed.accounts.some((acc: any) => acc.email.toLowerCase() === 'recruiter@irisoftware.com');
      if (!hasRecruiter) {
        parsed.accounts.push({
          id: 'usr-recruiter',
          name: 'Alisha Cooper',
          email: 'recruiter@irisoftware.com',
          passwordHash: hashPassword('recruiter123'),
          role: 'Recruiter',
          orgName: 'Kreo Software Labs',
          createdAt: new Date().toISOString()
        });
      }

      const hasBackupAdmin = parsed.accounts.some((acc: any) => acc.email.toLowerCase() === 'admin@irisoftware.com');
      if (!hasBackupAdmin) {
        parsed.accounts.push({
          id: 'usr-admin',
          name: 'System Admin',
          email: 'admin@irisoftware.com',
          passwordHash: hashPassword('admin123'),
          role: 'Admin',
          orgName: 'Kreo Software Enterprise',
          createdAt: new Date().toISOString()
        });
      }

      if (parsed.candidates && Array.isArray(parsed.candidates)) {
        const initialCount = parsed.candidates.length;
        parsed.candidates = parsed.candidates.filter((cand: any) => !isTestCandidate(cand));
        let updatedAny = initialCount !== parsed.candidates.length;

        parsed.candidates.forEach((cand: any) => {
          if (cand.status === 'Invited') {
            cand.status = 'Pending';
            updatedAny = true;
          }
          if (cand.aiAssessmentScore !== undefined) {
            delete cand.aiAssessmentScore;
            updatedAny = true;
          }
        });

        if (updatedAny) {
          try {
            fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
          } catch (e) {}
        }
      }

      // Auto-seed all default questions if needed
      const initialBankCount = (parsed.questionBank || []).length;
      seedQuestionBankFromZip(parsed);
      ensureQuestionBankPopulated(parsed);
      mergeDuplicateQuestionsInBank(parsed);
      if ((parsed.questionBank || []).length !== initialBankCount) {
        try {
          fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
        } catch (e) {}
      }

      inMemoryDb = parsed;
      return parsed;
    }
  } catch (error) {
    console.error('Error loading db.json, generating seeds', error);
  }

  // Seed assessments if database does not exist
  const seedAssessments: Assessment[] = [
    {
      id: 'asmt-react-dev',
      title: 'L1 Frontend Engineer (React/TypeScript)',
      roleLevel: 'Mid-Level',
      experienceRequired: '2-4 Years',
      jdText: 'We are looking for a Software Engineer focused on Frontend Development. You will be building user-facing systems with React 18, Tailwind CSS, and TypeScript. Experience with responsive layout, performance optimization, and integrating rest APIs is necessary.',
      skillsExtracted: ['React', 'TypeScript', 'Tailwind CSS', 'Performance Optimization', 'REST APIs'],
      status: 'Published',
      createdAt: new Date().toISOString(),
      questions: [
        {
          id: 'q-hr-1',
          category: 'hr',
          difficulty: 'Easy',
          question: 'Please introduce yourself and explain your current job notice period, current location, and expected fixed package salary in LPA.'
        },
        {
          id: 'q-tech-1',
          category: 'tech',
          difficulty: 'Moderate',
          question: 'What is the physical difference between useEffect with an empty dependency array and useEffect with no dependency array at all? Explain how it affects browser rendering.'
        },
        {
          id: 'q-tech-2',
          category: 'tech',
          difficulty: 'Moderate',
          question: 'Explain how virtual DOM works in React and how key prop optimizes list rendering algorithms.'
        },
        {
          id: 'q-tech-3',
          category: 'tech',
          difficulty: 'High',
          question: 'How do you handle client-side state in complex React apps, and when would you choose Context API over state-management libraries like Redux or Zustand?'
        },
        {
          id: 'q-code-1',
          category: 'coding',
          difficulty: 'High',
          question: 'Write a React hook named `useDebounce` that accepts a value and delay (ms) parameter, and returns the debounced rate-limited value.',
          suggestedAnswer: 'const useDebounce = (val, delay) => { ... }'
        },
        {
          id: 'q-code-2',
          category: 'coding',
          difficulty: 'Moderate',
          question: 'Write a JavaScript function to flatten a nested array of arbitrary depth. Do not use Array.prototype.flat().',
          suggestedAnswer: 'function flatten(arr) { ... }'
        }
      ]
    },
    {
      id: 'asmt-node-dev',
      title: 'DevOps & Backend Engineer (Node.js)',
      roleLevel: 'Senior',
      experienceRequired: '5+ Years',
      jdText: 'Seeking a backend developer skilled in Node.js, Express, PostgreSQL, AWS, and basic CI/CD pipelining. Must be able to orchestrate microservices and handle raw server operations.',
      skillsExtracted: ['Node.js', 'Express', 'PostgreSQL', 'AWS', 'Microservices', 'CI/CD'],
      status: 'Published',
      createdAt: new Date().toISOString(),
      questions: [
        {
          id: 'q-node-hr-1',
          category: 'hr',
          difficulty: 'Easy',
          question: 'Can you outline your availability, expected package (CTC), and experience working directly with AWS Cloud resources?'
        },
        {
          id: 'q-node-tech-1',
          category: 'tech',
          difficulty: 'High',
          question: 'Explain the Node.js event loop cycle phases (Timer, Poll, Check). How does process.nextTick differs from setImmediate?'
        },
        {
          id: 'q-node-code-1',
          category: 'coding',
          difficulty: 'High',
          question: 'Implement a basic Express middleware function that limits an IP address to 100 requests per minute. Use an in-memory storage record.',
          suggestedAnswer: 'function rateLimiter(req, res, next) { ... }'
        }
      ]
    }
  ];

  const seedAccounts: UserAccount[] = [
    {
      id: 'usr-saurabh',
      name: 'Saurabh Dey',
      email: 'saurabh.dey@irisoftware.com',
      passwordHash: hashPassword('saurabh$123%'),
      role: 'Admin',
      orgName: 'Kreo Software',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-recruiter',
      name: 'Alisha Cooper',
      email: 'recruiter@irisoftware.com',
      passwordHash: hashPassword('recruiter123'),
      role: 'Recruiter',
      orgName: 'Kreo Software Labs',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-admin',
      name: 'System Admin',
      email: 'admin@irisoftware.com',
      passwordHash: hashPassword('admin123'),
      role: 'Admin',
      orgName: 'Kreo Software Enterprise',
      createdAt: new Date().toISOString()
    }
  ];

  const initialDb: any = { assessments: seedAssessments, candidates: [], accounts: seedAccounts, questionBank: [] };
  inMemoryDb = initialDb;
  saveDb(initialDb, true);
  return initialDb;
}

/**
 * Retrieves the live in-memory database reference.
 */
export function getDb(): DbStore {
  if (!inMemoryDb) {
    inMemoryDb = loadDb();
  }
  return inMemoryDb;
}

/**
 * Recursively sanitizes an object for Firestore by removing any undefined properties.
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      sanitized[key] = sanitizeForFirestore(value);
    }
  }
  return sanitized;
}

/**
 * Saves database state locally and replicates changes to Cloud Firestore asynchronously.
 */
export function saveDb(data: DbStore, forceSync = false) {
  inMemoryDb = data;

  // 1. Local JSON write with atomic renaming and debounce
  if (forceSync) {
    if (nextWriteTimeout) {
      clearTimeout(nextWriteTimeout);
      nextWriteTimeout = null;
    }
    try {
      const tempPath = `${DB_PATH}.tmpync`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (err) {
      console.error('Error saving db.json synchronously:', err);
    }
  } else {
    if (nextWriteTimeout) {
      clearTimeout(nextWriteTimeout);
    }

    nextWriteTimeout = setTimeout(() => {
      nextWriteTimeout = null;
      writeQueue = writeQueue.then(async () => {
        try {
          const tempPath = `${DB_PATH}.tmp`;
          const dataStr = JSON.stringify(data, null, 2);
          await fs.promises.writeFile(tempPath, dataStr, 'utf-8');
          await fs.promises.rename(tempPath, DB_PATH);
        } catch (err) {
          console.error('Error saving db.json asynchronously:', err);
        }
      });
    }, 100);
  }

  // 2. Replicate to Cloud Firestore
  if (firebaseDb) {
    Promise.resolve().then(async () => {
      try {
        const accounts = (data as any).accounts || (data as any).users || [];
        for (const acc of accounts) {
          const emailKey = acc.email.toLowerCase().trim();
          await setDoc(doc(firebaseDb, 'accounts', emailKey), sanitizeForFirestore(acc));
        }
        for (const asmt of data.assessments) {
          await setDoc(doc(firebaseDb, 'assessments', asmt.id), sanitizeForFirestore(asmt));
        }
        for (const cand of data.candidates) {
          await setDoc(doc(firebaseDb, 'candidates', cand.id), sanitizeForFirestore(cand));
        }

        // Deletion synchronization
        const candSnap = await getDocs(collection(firebaseDb, 'candidates'));
        const incomingCandIds = new Set(data.candidates.map(c => c.id));
        for (const docSnap of candSnap.docs) {
          if (!incomingCandIds.has(docSnap.id)) {
            await deleteDoc(doc(firebaseDb, 'candidates', docSnap.id));
          }
        }

        const asmtSnap = await getDocs(collection(firebaseDb, 'assessments'));
        const incomingAsmtIds = new Set(data.assessments.map(a => a.id));
        for (const docSnap of asmtSnap.docs) {
          if (!incomingAsmtIds.has(docSnap.id)) {
            await deleteDoc(doc(firebaseDb, 'assessments', docSnap.id));
          }
        }

        const accSnap = await getDocs(collection(firebaseDb, 'accounts'));
        const incomingAccEmails = new Set(accounts.map((acc: any) => acc.email.toLowerCase().trim()));
        for (const docSnap of accSnap.docs) {
          if (!incomingAccEmails.has(docSnap.id.toLowerCase().trim())) {
            await deleteDoc(doc(firebaseDb, 'accounts', docSnap.id));
          }
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('Quota exceeded') || msg.includes('quota limit')) {
          console.warn('[FIREBASE] Quota limit exceeded - Cloud Firestore sync skipped to protect daily rate limits.');
        } else {
          console.error('[FIREBASE] Error syncing state with Cloud Firestore:', err);
        }
      }
    });
  }
}

/**
 * Performs startup synchronization between local storage and Cloud Firestore.
 */
export async function syncWithFirebase(localDb: DbStore): Promise<DbStore> {
  if (!firebaseDb) {
    return localDb;
  }
  try {
    console.log('[FIREBASE] Syncing local seed states with Cloud Firestore...');
    
    // Sync accounts with robust local-cloud merging
    const accountsCol = collection(firebaseDb, 'accounts');
    const accountsSnap = await getDocs(accountsCol);
    const accountMap = new Map<string, any>();

    const localAccounts = (localDb as any).accounts || (localDb as any).users || [];
    for (const acc of localAccounts) {
      if (acc && acc.email) {
        accountMap.set(acc.email.toLowerCase().trim(), acc);
      }
    }

    accountsSnap.forEach((docSnap) => {
      const cloudAcc = docSnap.data();
      if (cloudAcc && cloudAcc.email) {
        const key = cloudAcc.email.toLowerCase().trim();
        if (!accountMap.has(key)) {
          accountMap.set(key, cloudAcc);
        }
      }
    });

    const accounts = Array.from(accountMap.values());
    for (const account of accounts) {
      const emailKey = account.email.toLowerCase().trim();
      await setDoc(doc(firebaseDb, 'accounts', emailKey), sanitizeForFirestore(account));
    }

    // Sync assessments
    const assessmentsCol = collection(firebaseDb, 'assessments');
    const assessmentsSnap = await getDocs(assessmentsCol);
    let assessments: Assessment[] = [];
    if (assessmentsSnap.empty) {
      for (const asmt of localDb.assessments) {
        await setDoc(doc(firebaseDb, 'assessments', asmt.id), sanitizeForFirestore(asmt));
      }
      assessments = [...localDb.assessments];
    } else {
      assessmentsSnap.forEach((docSnap) => {
        assessments.push(docSnap.data() as Assessment);
      });
    }

    // Sync candidates
    const candidatesCol = collection(firebaseDb, 'candidates');
    const candidatesSnap = await getDocs(candidatesCol);
    let candidates: Candidate[] = [];
    if (candidatesSnap.empty) {
      const nonTestSeeds = localDb.candidates.filter(c => !isTestCandidate(c));
      for (const cand of nonTestSeeds) {
        await setDoc(doc(firebaseDb, 'candidates', cand.id), sanitizeForFirestore(cand));
      }
      candidates = [...nonTestSeeds];
    } else {
      const docsToDelete: string[] = [];
      candidatesSnap.forEach((docSnap) => {
        const cand = docSnap.data() as Candidate;
        if (isTestCandidate(cand)) {
          docsToDelete.push(docSnap.id);
        } else {
          candidates.push(cand);
        }
      });
      
      for (const docId of docsToDelete) {
        try {
          await deleteDoc(doc(firebaseDb, 'candidates', docId));
        } catch (delErr) {
          console.error(`[FIREBASE] Failed deleting cloud test candidate ${docId}:`, delErr);
        }
      }
    }

    const mergedDb: any = { accounts, assessments, candidates };
    inMemoryDb = mergedDb;
    return mergedDb;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('Quota exceeded') || msg.includes('quota limit')) {
      console.warn('[FIREBASE] Quota limit exceeded during startup sync - falling back to local memory store.');
    } else {
      console.error('[FIREBASE] Cloud synchronization failure, reverting to offline memory cache:', err);
    }
    return localDb;
  }
}

/**
 * Seeded pseudo-random shuffler to ensure consistent randomized subsets per candidate token.
 */
export function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const copy = [...array];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  let seedValue = Math.abs(h) || 1;
  const random = () => {
    const x = Math.sin(seedValue++) * 10000;
    return x - Math.floor(x);
  };
  
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Guarantees question bank is never empty by seeding a robust baseline of default questions.
 */
export function ensureQuestionBankPopulated(db: DbStore): void {
  if (!db.questionBank) db.questionBank = [];
  if (db.questionBank.length > 0) return;

  const now = new Date().toISOString();
  db.questionBank = [
    { id: 'q-fb-1', skill: 'Java', skillCategory: 'Backend', subTopic: 'Concurrency', difficulty: 'Moderate', category: 'Technical', question: 'Explain how ThreadPoolExecutor works in Java and how core pool size differs from maximum pool size.', sampleAnswer: 'Core threads are kept alive, unbounded queue holds tasks until full, then new threads up to max are spawned.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-2', skill: 'Spring Boot', skillCategory: 'Backend', subTopic: 'Dependency Injection', difficulty: 'Moderate', category: 'Technical', question: 'What is the difference between @Component, @Service, and @Repository annotations in Spring Boot?', sampleAnswer: 'They are specializations of @Component with semantic meaning and persistence exception translation.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-3', skill: 'Kafka', skillCategory: 'Distributed Systems', subTopic: 'Messaging', difficulty: 'Difficult', category: 'Technical', question: 'How does Kafka consumer group rebalancing work, and how do you handle partition reassignment latency?', sampleAnswer: 'Consumer heartbeat checks, group coordinator assigns partitions, cooperative sticky assignor minimizes disruption.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-4', skill: 'React', skillCategory: 'Frontend', subTopic: 'State Management', difficulty: 'Moderate', category: 'Technical', question: 'What is the physical difference between useMemo and useCallback in React 18?', sampleAnswer: 'useMemo caches computed values, useCallback caches function references across renders.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-5', skill: 'Node.js', skillCategory: 'Backend', subTopic: 'Event Loop', difficulty: 'Moderate', category: 'Technical', question: 'Explain the phases of the Node.js Event Loop and how process.nextTick differs from setImmediate.', sampleAnswer: 'nextTick executes before microtask queue continuation, setImmediate runs in the check phase.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-6', skill: 'Python', skillCategory: 'Backend', subTopic: 'Memory Management', difficulty: 'Moderate', category: 'Technical', question: 'How does Python handle garbage collection with reference counting and cyclic garbage collection?', sampleAnswer: 'Reference counting instantly reclaims objects at zero refs; generational cyclic GC handles circular references.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-7', skill: 'System Design', skillCategory: 'Architecture', subTopic: 'Scalability', difficulty: 'Difficult', category: 'Technical', question: 'Design a distributed rate limiter supporting 10 million requests per second with sub-millisecond latency.', sampleAnswer: 'Use Redis cluster with sliding window counter or token bucket algorithm.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-8', skill: 'SQL', skillCategory: 'Databases', subTopic: 'Indexing', difficulty: 'Moderate', category: 'Technical', question: 'How do B-Tree indexes work in relational databases, and when would a bitmap index be preferred?', sampleAnswer: 'B-Tree balances lookup depth for range queries; bitmap indexes suit low-cardinality columns.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-9', skill: 'Java', skillCategory: 'Coding', subTopic: 'Algorithms', difficulty: 'Difficult', category: 'Coding', question: 'Write a Java method to detect a cycle in a singly linked list and return the starting node of the cycle.', sampleAnswer: 'Use Floyd s Cycle-Finding Algorithm with slow and fast pointers.', createdAt: now, updatedAt: now, source: 'default_bank' },
    { id: 'q-fb-10', skill: 'Python', skillCategory: 'Coding', subTopic: 'Data Structures', difficulty: 'Moderate', category: 'Coding', question: 'Write an optimized Python function to group a list of anagram strings efficiently.', sampleAnswer: 'Sort characters of each string and use as dictionary keys mapping to lists of matching words.', createdAt: now, updatedAt: now, source: 'default_bank' }
  ];
}

