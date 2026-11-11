import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const CONCURRENT_USERS = 150;
const DB_PATH = path.join(process.cwd(), 'db.json');

interface UserMetrics {
  userId: number;
  success: boolean;
  errors: string[];
  latencyRegister?: number;
  latencyValidate?: number;
  latencyStart?: number;
  latencyEvaluate?: number[];
  latencyComplete?: number;
}

async function runLoadTest() {
  console.log('====================================================');
  console.log('       IRIS INTERVIEW ENGINE - QA & LOAD TESTER      ');
  console.log(`               Simulating ${CONCURRENT_USERS} Virtual Users     `);
  console.log('====================================================');
  console.log(`Target Service: ${BASE_URL}\n`);

  // Check if server is running
  try {
    const healthResp = await fetch(`${BASE_URL}/api/db-state`);
    if (!healthResp.ok) {
      throw new Error(`Server returned status ${healthResp.status}`);
    }
    console.log('[✔] Target server is online and accessible.');
  } catch (err: any) {
    console.error('[✘] Error: Target server is not running or not accessible.', err.message);
    process.exit(1);
  }

  // Record initial database size
  let initialDbSize = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      initialDbSize = fs.statSync(DB_PATH).size;
      console.log(`[i] Initial active database size: ${(initialDbSize / 1024).toFixed(2)} KB`);
    } else {
      console.log('[i] Database file db.json does not exist yet (it will be created on save)');
    }
  } catch (err) {}

  // Reset the database state to original seeds before the load test
  try {
    const freshDbResp = await fetch(`${BASE_URL}/api/db-state`);
    if (freshDbResp.ok) {
      const dbState: any = await freshDbResp.json();
      dbState.candidates = dbState.candidates.filter((c: any) => !c.name.startsWith('Test User '));
      
      await fetch(`${BASE_URL}/api/db-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbState)
      });
      console.log('[✔] Database restored: All previous load-test candidate metrics cleared.');
    }
  } catch (err) {
    console.warn('[⚠️] Could not reset candidates before test', err);
  }

  const startTime = Date.now();
  const metrics: UserMetrics[] = [];

  // Launch all virtual users concurrently
  const userPromises = Array.from({ length: CONCURRENT_USERS }).map((_, index) => {
    return simulateVirtualUser(index + 1);
  });

  console.log(`[▶] Dispatched ${CONCURRENT_USERS} concurrent requests...`);
  const results = await Promise.all(userPromises);
  const totalDuration = Date.now() - startTime;

  console.log('\n[✔] All virtual user cycles completed.');
  console.log('[...] Waiting 1.5 seconds for the server async queue to fully flush final state to disk...');
  await new Promise(resolve => setTimeout(resolve, 1500));

  console.log('====================================================');
  console.log('                LOAD TEST ANALYTICS                 ');
  console.log('====================================================');

  const successCount = results.filter(r => r.success).length;
  const failCount = CONCURRENT_USERS - successCount;
  const successRate = ((successCount / CONCURRENT_USERS) * 100).toFixed(1);

  console.log(`Total Simulated Users  : ${CONCURRENT_USERS}`);
  console.log(`Success Count          : ${successCount} (${successRate}%)`);
  console.log(`Failure Count          : ${failCount}`);
  console.log(`Total Test Execution   : ${(totalDuration / 1000).toFixed(2)} seconds`);
  console.log(`Average Throughput     : ${(CONCURRENT_USERS / (totalDuration / 1000)).toFixed(1)} operations/sec\n`);

  // Extract latency telemetry
  const latenciesRegister = results.map(r => r.latencyRegister).filter(Number) as number[];
  const latenciesValidate = results.map(r => r.latencyValidate).filter(Number) as number[];
  const latenciesStart = results.map(r => r.latencyStart).filter(Number) as number[];
  const latenciesEvaluate = results.flatMap(r => r.latencyEvaluate || []).filter(Number) as number[];
  const latenciesComplete = results.map(r => r.latencyComplete).filter(Number) as number[];

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0;

  console.log('Latency Metrics (Average / Max in milliseconds):');
  console.log(`- Candidate Registration    : ${avg(latenciesRegister).toString().padEnd(5)} ms (Max: ${max(latenciesRegister)} ms)`);
  console.log(`- Token Validation          : ${avg(latenciesValidate).toString().padEnd(5)} ms (Max: ${max(latenciesValidate)} ms)`);
  console.log(`- Assessment Starting        : ${avg(latenciesStart).toString().padEnd(5)} ms (Max: ${max(latenciesStart)} ms)`);
  console.log(`- Answer Evaluation (Gemini): ${avg(latenciesEvaluate).toString().padEnd(5)} ms (Max: ${max(latenciesEvaluate)} ms)`);
  console.log(`- Full Assessment Complete : ${avg(latenciesComplete).toString().padEnd(5)} ms (Max: ${max(latenciesComplete)} ms)`);

  console.log('\n====================================================');
  console.log('            DATABASE INTEGRITY AUDIT                ');
  console.log('====================================================');

  // Verify that all users are fully written to db.json and that there is no parsing/corruption issue
  try {
    if (fs.existsSync(DB_PATH)) {
      const finalDbSize = fs.statSync(DB_PATH).size;
      const dataStr = fs.readFileSync(DB_PATH, 'utf-8');
      const loadedDb = JSON.parse(dataStr);
      
      console.log(`[✔] File parsing: SUCCESS (No corruption detected)`);
      console.log(`[✔] Final database size: ${(finalDbSize / 1024).toFixed(2)} KB`);
      
      const createdCount = loadedDb.candidates.filter((c: any) => c.name.startsWith('Test User ')).length;
      const completedCount = loadedDb.candidates.filter((c: any) => c.name.startsWith('Test User ') && c.status === 'Completed').length;
      
      console.log(`[✔] Candidates initiated in db    : ${createdCount} / ${CONCURRENT_USERS}`);
      console.log(`[✔] Candidates completed in db    : ${completedCount} / ${CONCURRENT_USERS}`);
      
      if (createdCount !== CONCURRENT_USERS || completedCount !== CONCURRENT_USERS) {
        console.warn(`[⚠️ WARNING] Concurrent Write Loss Detected! Expected ${CONCURRENT_USERS} records, found ${createdCount}. Complete count expected ${CONCURRENT_USERS}, found ${completedCount}.`);
        console.warn('This suggests overlapping synchronous writes caused concurrent data loss (race conditions).');
      } else {
        console.log('[✔] Integrity Check completely passed! No concurrent write loss detected.');
      }
    } else {
      console.log('[✘] Error: db.json was not created/persisted.');
    }
  } catch (err: any) {
    console.error('[✘] Error parsing final db.json! Data corruption occurred: ', err.message);
  }
}

async function simulateVirtualUser(userId: number): Promise<UserMetrics> {
  const metric: UserMetrics = {
    userId,
    success: false,
    errors: [],
    latencyEvaluate: []
  };

  try {
    // 1. Candidate Registration
    const startRegister = Date.now();
    const regResp = await fetch(`${BASE_URL}/api/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Test User ${userId}`,
        email: `test_user_load_${userId}@gmail.com`,
        phone: `+91 95000${userId.toString().padStart(5, '0')}`,
        assessmentId: 'asmt-react-dev',
        experience: `${3 + (userId % 5)} Years`,
        location: userId % 2 === 0 ? 'Kolkata' : 'Mumbai',
        skillsExtracted: ['React', 'TypeScript', 'Tailwind CSS']
      })
    });

    if (!regResp.ok) {
      throw new Error(`Register failed: Status ${regResp.status}`);
    }
    const candidateData: any = await regResp.json();
    metric.latencyRegister = Date.now() - startRegister;
    const token = candidateData.token;

    if (!token) {
      throw new Error('Register response did not contain assessment token.');
    }

    // 2. Token Validation
    const startValidate = Date.now();
    const valResp = await fetch(`${BASE_URL}/api/interview/validate/${token}`);
    if (!valResp.ok) {
      throw new Error(`Validate failed: Status ${valResp.status}`);
    }
    await valResp.json();
    metric.latencyValidate = Date.now() - startValidate;

    // 3. Start Assessment
    const startStart = Date.now();
    const startResp = await fetch(`${BASE_URL}/api/interview/${token}/start`, {
      method: 'POST'
    });
    if (!startResp.ok) {
      throw new Error(`Start assessment failed: Status ${startResp.status}`);
    }
    metric.latencyStart = Date.now() - startStart;

    // 4. Submit Answers (3 Rounds)
    const questionsToAnswer = [
      { id: 'q-hr-1', text: 'Introduce yourself.', category: 'hr' },
      { id: 'q-tech-1', text: 'What is the physical difference between useEffect with an empty dependency array and with no array?', category: 'tech' },
      { id: 'q-tech-2', text: 'Explain how virtual DOM works in React.', category: 'tech' }
    ];

    for (const q of questionsToAnswer) {
      const startEval = Date.now();
      const evalResp = await fetch(`${BASE_URL}/api/interview/${token}/evaluate-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: q.id,
          questionText: q.text,
          category: q.category,
          candidateAnswer: `Here is my high-performance response from simulated virtual candidate ${userId} detailing modern development paradigms.`,
          isCrossAnswer: false
        })
      });

      if (!evalResp.ok) {
        throw new Error(`Evaluate answer ${q.id} failed: Status ${evalResp.status}`);
      }
      await evalResp.json();
      metric.latencyEvaluate!.push(Date.now() - startEval);
    }

    // 5. Complete Assessment
    const startComplete = Date.now();
    const compResp = await fetch(`${BASE_URL}/api/interview/${token}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isSuspended: false,
        proctoringSummary: {
          tabSwitches: userId % 4 === 0 ? 1 : 0,
          browserFocusViolations: 0,
          faceDetectionsLost: 0,
          copyPasteAttempts: 0,
          cameraOffViolations: 0,
          notVisibleViolations: 0
        },
        transcripts: [
          {
            questionId: 'q-hr-1',
            category: 'hr',
            questionText: 'Introduce yourself.',
            candidateAnswer: `Intro text from user ${userId}`
          }
        ]
      })
    });

    if (!compResp.ok) {
      throw new Error(`Complete failed: Status ${compResp.status}`);
    }
    await compResp.json();
    metric.latencyComplete = Date.now() - startComplete;

    metric.success = true;
  } catch (err: any) {
    metric.success = false;
    metric.errors.push(err.message || String(err));
    console.error(`[Candidate-${userId} Error]:`, err.message || err);
  }

  return metric;
}

runLoadTest();
