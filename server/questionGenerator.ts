/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Question Bank Generation, Skill Extraction & Code Boilerplate Engine.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { Question, QuestionBankItem, DbStore } from './types';
import { generateContentWithFallback, cleanAndParseJSON, isGroqConfigured } from './gemini';
import { getDb, saveDb, shuffleWithSeed } from './db';
import { getEmbedding, cosineSimilarity } from './embeddingService';

export { shuffleWithSeed };

/**
 * Translates JavaScript starter boilerplate into Python, SQL, or Scala if required.
 */
export function translateBoilerplate(javascriptBoilerplate: string, language: string, skill: string): string {
  const lang = language ? language.toLowerCase() : '';
  
  if (lang === 'python' || lang === 'pyspark') {
    if (javascriptBoilerplate.includes('longestUniqueSubstring')) {
      return `def longest_unique_substring(s: str) -> int:\n    # Find length of longest substring without repeating characters\n    # TODO: Implement sliding window algorithm\n    return 0`;
    }
    if (javascriptBoilerplate.includes('mergeIntervals')) {
      return `def merge_intervals(intervals: list) -> list:\n    # Merge overlapping intervals and return sorted list\n    # TODO: Sort intervals and merge overlapping spans\n    return []`;
    }
    if (javascriptBoilerplate.includes('TokenBucketLimiter')) {
      return `class TokenBucketLimiter:\n    def __init__(self, capacity: int, refill_rate: float):\n        self.capacity = capacity\n        self.refill_rate = refill_rate\n        self.tokens = capacity\n\n    def allow_request(self) -> bool:\n        # TODO: Implement token bucket logic\n        return True`;
    }
    if (javascriptBoilerplate.includes('reverseLinkedList')) {
      return `def reverse_linked_list(head):\n    # Reverse singly linked list in-place and return new head\n    # TODO: In-place pointer swapping...\n    return None`;
    }
    if (javascriptBoilerplate.includes('isValidBrackets')) {
      return `def is_valid_brackets(s: str) -> bool:\n    # Validate expression nested brace constraints\n    # TODO: Use a stack to match parentheses\n    return False`;
    }
    if (javascriptBoilerplate.includes('firstMissingPositive')) {
      return `def first_missing_positive(nums: list) -> int:\n    # Find first missing positive integer in O(n) time and O(1) space\n    # TODO: Implement cycle sort or index allocation\n    return 1`;
    }
    if (javascriptBoilerplate.includes('maxHierarchyDepth')) {
      return `def max_hierarchy_depth(root_employee) -> int:\n    # Return maximum depth of employee reporting structure\n    # TODO: DFS/BFS traversal tracking active levels\n    return 0`;
    }
    if (javascriptBoilerplate.includes('deduplicateUsers')) {
      return `def deduplicate_users(records: list) -> list:\n    # Deduplicate users keeping the latest record\n    # TODO: Filter records and keep single latest per user\n    return []`;
    }
    if (javascriptBoilerplate.includes('groupAnagrams')) {
      return `def group_anagrams(words: list) -> list:\n    # Group anagram words together\n    # TODO: Implement sorting tracking frequency hashes\n    return []`;
    }
    if (javascriptBoilerplate.includes('retryWithBackoff')) {
      return `import time\nimport random\n\ndef retry_with_backoff(fn, retries=3, delay=1.0):\n    # TODO: Loop calls with exponential waiting delays\n    pass`;
    }
    if (javascriptBoilerplate.includes('convertToHierarchyTree')) {
      return `def convert_to_hierarchy_tree(categories: list) -> list:\n    # Convert flat list with parent relationships to nested tree\n    # TODO: Establish parent-child reference maps\n    return []`;
    }
    if (javascriptBoilerplate.includes('LRUCache')) {
      return `class LRUCache:\n    def __init__(self, capacity: int):\n        self.capacity = capacity\n        self.cache = {}\n\n    def get(self, key: any) -> any:\n        # TODO: Implement O(1) retrieval\n        return -1\n\n    def put(self, key: any, value: any) -> None:\n        # TODO: Implement O(1) insertion and eviction\n        pass`;
    }
    if (javascriptBoilerplate.includes('sanitizeUrl')) {
      return `def sanitize_url(raw_url: str) -> str:\n    # Search and extract clean URL payloads, filtering out XSS\n    # TODO: Robust pattern parsing and parameter shielding\n    return ''`;
    }
    if (javascriptBoilerplate.includes('lowestCommonAncestor')) {
      return `def lowest_common_ancestor(root, p, q):\n    # Find lowest common ancestor of p and q in a BST\n    # TODO: Traversal tracking key node parents\n    return None`;
    }
    if (javascriptBoilerplate.includes('splitIntoPackets')) {
      return `def split_into_packets(stream_bytes: bytes, packet_size: int) -> list:\n    # Split massive raw byte stream into custom sized packets\n    # TODO: Slice buffers into packets\n    return []`;
    }
    if (javascriptBoilerplate.includes('MinMaxStack')) {
      return `class MinMaxStack:\n    # O(1) concurrent stack with push, pop, and max-index-retrieval\n    def __init__(self):\n        self.stack = []\n\n    def push(self, val: int) -> None:\n        pass\n\n    def pop(self) -> int:\n        return -1\n\n    def get_max(self) -> int:\n        return -1`;
    }
    if (javascriptBoilerplate.includes('extractIPs')) {
      return `import re\n\ndef extract_ips(log_content: str) -> list:\n    # Extract alphanumeric IP addresses from logs using regex\n    # TODO: Compile pattern matched sets\n    return []`;
    }
    if (javascriptBoilerplate.includes('minCoinsToTarget')) {
      return `def min_coins_to_target(coins: list, target: int) -> int:\n    # Calculate minimum coins required to reach target value\n    # TODO: Build bottom-up memoization array\n    return 0`;
    }
    if (javascriptBoilerplate.includes('executeWithConcurrencyLimit')) {
      return `def execute_with_concurrency_limit(tasks: list, limit: int):\n    # Task coordinator limiting concurrent executions\n    # TODO: Throttle active tasks\n    pass`;
    }
    if (javascriptBoilerplate.includes('rotateMatrixInPlace')) {
      return `def rotate_matrix_in_place(matrix: list) -> None:\n    # Rotate a 2D square matrix by 90 degrees clockwise in-place\n    # TODO: Perform transpose and horizontal swaps\n    pass`;
    }
    if (javascriptBoilerplate.includes('longestConsecutiveSequence')) {
      return `def longest_consecutive_sequence(nums: list) -> int:\n    # Retrieve the longest consecutive sequence of integers\n    # TODO: Establish sets and search consecutive numbers\n    return 0`;
    }
    if (javascriptBoilerplate.includes('calculateSqrt')) {
      return `def calculate_sqrt(val: float, epsilon: float = 1e-6) -> float:\n    # Binary search solver to find square root\n    # TODO: Iterative binary searching\n    return 0.0`;
    }
    if (javascriptBoilerplate.includes('BufferAllocator')) {
      return `class BufferAllocator:\n    # Simulate block-based heap reservations and garbage-disposal\n    def __init__(self, size: int):\n        self.size = size\n        self.blocks = []`;
    }
    if (javascriptBoilerplate.includes('deserializeGraph')) {
      return `def deserialize_graph(binary_buffer: bytes):\n    # Deserialize binary array into object graph safely\n    # TODO: Parse bytes, resolve circular links\n    return {}`;
    }
    if (javascriptBoilerplate.includes('findShortestRoute')) {
      return `def find_shortest_route(network: dict, start_node: str, end_node: str) -> list:\n    # Find shortest path between two servers using weights\n    # TODO: Implement Dijkstra or A* algorithm\n    return []`;
    }
    if (javascriptBoilerplate.includes('tokenizeSearchQuery')) {
      return `def tokenize_search_query(query: str) -> list:\n    # Split search criteria by nested operators AND, OR, NOT\n    # TODO: Lexical string slicing\n    return []`;
    }
    if (javascriptBoilerplate.includes('topologicalTaskSort')) {
      return `def topological_task_sort(tasks: list) -> list:\n    # Schedule dependent tasks, validating DAG contains no cycles\n    # TODO: Topological sorting using Kahn's algorithm\n    return []`;
    }
    if (javascriptBoilerplate.includes('verifyPayloadHash')) {
      return `def verify_payload_hash(payload: dict, expected_hash: str) -> bool:\n    # Checksum/hash validator for data corruption checks\n    # TODO: Hash encryption checks\n    return False`;
    }
    if (javascriptBoilerplate.includes('maxSlidingWindow')) {
      return `def max_sliding_window(nums: list, k: int) -> list:\n    # Retrieve maximum values of each sub-array of length K\n    # TODO: Monotonic queue pattern\n    return []`;
    }
    if (javascriptBoilerplate.includes('findGCDAndLCM')) {
      return `def find_gcd_and_lcm(numbers: list) -> dict:\n    # Calculate GCD and LCM of a list of integers\n    # TODO: Euclidean algorithm\n    return {"gcd": 1, "lcm": 1}`;
    }

    return `def solve_challenge(*args, **kwargs):\n    # Core coding solution for ${skill}\n    # TODO: Implement LeetCode-style algorithm\n    pass`;
  }

  if (lang === 'sql') {
    let tableName = 'transactions';
    let comment = 'Write an optimized OLAP/analytical SQL query';
    if (javascriptBoilerplate.includes('longestUniqueSubstring')) {
      comment = 'Write a SQL query to isolate sequence trends';
    } else if (javascriptBoilerplate.includes('mergeIntervals')) {
      comment = 'Write a SQL query to merge overlapping intervals or scheduling slots';
      tableName = 'bookings';
    } else if (javascriptBoilerplate.includes('deduplicateUsers')) {
      comment = 'Deduplicate records using ROW_NUMBER() window partitioned by user';
      tableName = 'user_logs';
    } else if (javascriptBoilerplate.includes('maxHierarchyDepth')) {
      comment = 'Write a recursive CTE to trace maximum organizational hierarchy depth';
      tableName = 'employees';
    }

    return `-- Core Skill Required: ${skill}\n-- ${comment}\n\nWITH CTE_Ranked AS (\n  SELECT \n    *,\n    ROW_NUMBER() OVER(PARTITION BY id ORDER BY updated_at DESC) as rnk\n  FROM ${tableName}\n)\nSELECT \n  * \nFROM CTE_Ranked \nWHERE rnk = 1;\n`;
  }

  if (lang === 'scala') {
    if (javascriptBoilerplate.includes('longestUniqueSubstring')) {
      return `def longestUniqueSubstring(s: String): Int = {\n  // TODO: Implement sliding window algorithm\n  0\n}`;
    }
    if (javascriptBoilerplate.includes('mergeIntervals')) {
      return `def mergeIntervals(intervals: List[List[Int]]): List[List[Int]] = {\n  // TODO: Sort intervals and merge overlapping spans\n  List()\n}`;
    }
    if (javascriptBoilerplate.includes('deduplicateUsers')) {
      return `case class UserRecord(id: String, timestamp: Long, data: String)\n\ndef deduplicateUsers(records: List[UserRecord]): List[UserRecord] = {\n  // TODO: Filter records and keep the single latest record for each user\n  List()\n}`;
    }
    return `def solveChallenge(input: Any): Any = {\n  // Scala algorithmic challenge for ${skill}\n  // TODO: Implement algorithm\n  null\n}`;
  }

  return javascriptBoilerplate;
}

/**
 * Offline skill extraction fallback based on key phrases and substring matches.
 */
export function extractSkillsOffline(jdText: string, titleStr: string): string[] {
  const commonSkills = [
    'React', 'TypeScript', 'Vue', 'Angular', 'Node.js', 'Python', 'Django', 'Flask', 'Java', 'Spring Boot', 'C#', 'Go', 'Rust', 'C++', 'Ruby', 'PHP', 
    'SQL', 'PostgreSQL', 'MySQL', 'SQL Server', 'Oracle', 'MongoDB', 'Redis', 'Elasticsearch', 'Snowflake', 'Data Warehousing', 'ETL', 'ETL Testing', 
    'QA Automation', 'Selenium', 'Cypress', 'Playwright', 'Docker', 'Kubernetes', 'Git', 'Jenkins', 'AWS', 'GCP', 'Azure', 'Firebase', 'Terraform', 
    'PySpark', 'Apache Spark', 'Informatica', 'Talend', 'Tableau', 'Power BI', 'Salesforce', 'SAP', 'Figma', 'UI/UX Design', 'Machine Learning', 
    'Deep Learning', 'NLP', 'Computer Vision', 'Data Structures', 'Algorithms', 'Agile', 'Scrum', 'Jira', 'Data Validation', 'Data Quality',
    'SSIS', 'DataStage', 'Regression Testing', 'Functional Testing', 'Integration Testing', 'System Integration Testing', 'Test Strategy', 'Test Plans',
    'Test Cases', 'Concurrency', 'Low Latency', 'Multithreading', 'Thread Safety', 'High Throughput', 'Distributed Systems', 'Microservices',
    'Event-Driven Architecture', 'Kafka', 'WebSockets', 'gRPC', 'GraphQL', 'System Design', 'Memory Management'
  ];

  const found = new Set<string>();
  const textToCheck = `${titleStr || ''} ${jdText || ''}`.toLowerCase();

  for (const skill of commonSkills) {
    let regex: RegExp;
    if (skill === 'C++') {
      regex = /c\+\+/i;
    } else if (skill === 'C#') {
      regex = /c#/i;
    } else if (skill === '.NET') {
      regex = /\.net/i;
    } else {
      const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (/[\W_]/.test(skill)) {
        regex = new RegExp(`(?:^|\\s|[^a-zA-Z0-9])(${escaped})(?:$|\\s|[^a-zA-Z0-9])`, 'i');
      } else {
        regex = new RegExp(`\\b${escaped}\\b`, 'i');
      }
    }

    if (regex.test(textToCheck)) {
      found.add(skill);
    }
  }

  if (/\bqa\b/i.test(textToCheck) || /\bqa testing\b/i.test(textToCheck)) {
    found.add('QA Automation');
  }
  if (/\betl\b/i.test(textToCheck)) {
    found.add('ETL');
  }
  if (/\bdata warehouse\b/i.test(textToCheck) || /\bdwh\b/i.test(textToCheck)) {
    found.add('Data Warehousing');
  }
  if (/\btesting\b/i.test(textToCheck)) {
    if (!found.has('ETL Testing') && /\betl\b/i.test(textToCheck)) {
      found.add('ETL Testing');
    }
  }

  if (found.size > 0) {
    return Array.from(found).slice(0, 15);
  }

  const tLower = (titleStr || '').toLowerCase();
  if (tLower.includes('java')) {
    return ['Java', 'Spring Boot', 'Kafka', 'Distributed Systems', 'Microservices', 'SQL'];
  }
  if (tLower.includes('python')) {
    return ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'AWS', 'Redis'];
  }
  if (tLower.includes('react') || tLower.includes('frontend')) {
    return ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'REST APIs'];
  }
  return ['Java', 'Spring Boot', 'Kafka', 'Distributed Systems', 'SQL', 'Microservices'];
}

/**
 * Extracts granular skills from Job Description text using Gemini with offline fallback.
 */
export async function extractSkillsFromJd(
  ai: GoogleGenAI | null,
  title: string,
  roleLevel: string,
  experienceRequired: string,
  jdText: string
): Promise<string[]> {
  let skillsExtracted: string[] = [];

  if (ai || isGroqConfigured()) {
    try {
      const skillsPrompt = `
Analyze the following Job Description (JD) text and extract ALL specific, granular skill terms mentioned or directly required.
This must include:
1. Core programming languages, frameworks, packages, database engines, and cloud tools.
2. Specific technical sub-domains, architectural concepts, and execution skills.
3. Methodologies, data engineering techniques, testing patterns.
4. Crucial professional attributes or soft skills explicitly mentioned as requirements.

Each item must be a real, crisp, searchable skill term (1 to 4 words maximum). Extract between 10 to 20 skills.

Role Info:
- Title target: ${title || 'Software Specialist'}
- Seniority Target: ${roleLevel || 'Mid-Level'}
- JD Text: "${jdText}"

Output strictly in JSON matching the schema.`;

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
      if (parsed.skillsExtracted && Array.isArray(parsed.skillsExtracted)) {
        skillsExtracted = parsed.skillsExtracted.map((s: string) => s.trim()).filter(Boolean);
      }
    } catch (e: any) {
      console.warn('[GEMINI SKILL EXTRACTION] Utilizing offline matcher:', e.message || e);
    }
  }

  if (skillsExtracted.length === 0) {
    skillsExtracted = extractSkillsOffline(jdText, title);
  }

  return skillsExtracted;
}

/**
 * Selects and maps questions directly from the Question Bank based on target skills,
 * enforcing negative filters (e.g. no Full Stack/Agile for backend roles), balancing
 * questions across all requested skills, and applying an adaptive difficulty progression.
 */
export async function selectQuestionsFromQuestionBank(
  mandatorySkills: string[],
  goodToHaveSkills: string[],
  targetTechCount: number = 50,
  targetCodingCount: number = 50
): Promise<Question[]> {
  const db = getDb();
  let bankItems: QuestionBankItem[] = db.questionBank || [];

  if (bankItems.length === 0) {
    return [];
  }

  // Optimize performance: if bank is huge (>2000 items), slice/sample to ensure sub-10ms instant response
  if (bankItems.length > 2000) {
    bankItems = bankItems.slice(0, 2000);
  }

  // Deduplicate and trim requested skills
  const cleanMandatory = Array.from(new Set(
    (mandatorySkills || []).map(s => (typeof s === 'string' ? s.trim() : String(s).trim())).filter(s => s.length > 0)
  ));
  const cleanGood = Array.from(new Set(
    (goodToHaveSkills || []).map(s => (typeof s === 'string' ? s.trim() : String(s).trim())).filter(s => s.length > 0)
  ));

  if (cleanMandatory.length === 0 && cleanGood.length === 0) {
    cleanMandatory.push('Java', 'Spring Boot', 'Kafka', 'Distributed Systems', 'SQL');
  }

  const allSkills = [...cleanMandatory, ...cleanGood];
  const combinedSkillsLower = allSkills.map(s => s.toLowerCase()).join(' ');

  // Fetch true vector embeddings for requested skills via gemini-embedding-001 with fallback tolerance
  const skillEmbeddings = new Map<string, number[]>();
  for (const sk of allSkills) {
    try {
      const emb = await getEmbedding(sk);
      if (emb) {
        skillEmbeddings.set(sk, emb);
      }
    } catch (e) {}
  }

  // Comprehensive enterprise-grade semantic skill clusters and synonym expansions
  const synonymsMap: Record<string, string[]> = {
    'java backend': ['java', 'jvm', 'concurrency', 'multithreading', 'garbage collection', 'memory management', 'thread safety', 'low latency', 'thread', 'backend', 'microservice', 'classloader', 'collections', 'streams', 'oop'],
    'distributed systems': ['distributed', 'replication', 'partition', 'consensus', 'fault tolerance', 'cap theorem', 'idempotent', 'cluster', 'node', 'event-driven', 'microservices', 'high availability', 'load balancer', 'failover', 'sharding'],
    'distributed system': ['distributed', 'replication', 'partition', 'consensus', 'fault tolerance', 'cap theorem', 'idempotent', 'cluster', 'node', 'event-driven', 'microservices', 'high availability', 'load balancer', 'failover', 'sharding'],
    'kafka': ['kafka', 'consumer group', 'partitions', 'topics', 'broker', 'producer', 'offset', 'event stream', 'message broker', 'pub/sub', 'zookeeper'],
    'spring': ['spring', 'spring boot', 'dependency injection', 'ioc', 'bean', 'autowired', 'profile', 'controller', 'application context', 'spring data', 'spring security'],
    'spring boot': ['spring', 'spring boot', 'dependency injection', 'ioc', 'bean', 'autowired', 'profile', 'controller', 'application context', 'spring data', 'spring security'],
    'java': ['java', 'jvm', 'collections', 'stream', 'concurrency', 'garbage collector', 'oop', 'classloader', 'thread'],
    'python': ['python', 'django', 'flask', 'fastapi', 'asyncio', 'generators', 'decorators', 'numpy', 'pandas', 'gil'],
    'sql': ['sql', 'query', 'join', 'index', 'database', 'transaction', 'acid', 'stored procedure', 'normalization'],
    'postgresql': ['postgresql', 'postgres', 'sql', 'query', 'join', 'index', 'database', 'transaction', 'acid', 'pl/pgsql'],
    'microservices': ['microservice', 'api gateway', 'service mesh', 'circuit breaker', 'distributed', 'grpc', 'rest api'],
    'concurrency': ['concurrency', 'multithreading', 'thread safe', 'lock', 'mutex', 'atomic', 'deadlock', 'race condition', 'volatile'],
    'low latency': ['low latency', 'throughput', 'gc tuning', 'off-heap', 'zero copy', 'profiling', 'cache miss', 'memory efficiency'],
    'react': ['react', 'jsx', 'hooks', 'redux', 'react query', 'state management', 'virtual dom', 'components', 'next.js', 'ssr', 'router'],
    'react.js': ['react', 'jsx', 'hooks', 'redux', 'react query', 'state management', 'virtual dom', 'components', 'next.js', 'ssr', 'router'],
    'next.js': ['next.js', 'ssr', 'ssg', 'react', 'routing', 'api routes', 'hydration', 'edge functions'],
    'typescript': ['typescript', 'types', 'interfaces', 'generics', 'compiler', 'type safety', 'enums', 'javascript'],
    'node.js': ['node.js', 'express', 'event loop', 'async', 'middleware', 'streams', 'npm', 'cluster', 'buffer'],
    'aws': ['aws', 's3', 'ec2', 'lambda', 'dynamodb', 'cloudwatch', 'iam', 'vpc', 'rds', 'ecs'],
    'docker': ['docker', 'container', 'image', 'Dockerfile', 'compose', 'volume', 'networking'],
    'kubernetes': ['kubernetes', 'k8s', 'pod', 'deployment', 'ingress', 'service', 'helm', 'cluster'],
    'devops': ['devops', 'ci/cd', 'pipeline', 'terraform', 'ansible', 'docker', 'kubernetes', 'aws', 'linux', 'monitoring', 'sre', 'git'],
    'ci/cd': ['ci/cd', 'pipeline', 'github actions', 'jenkins', 'gitlab', 'automation', 'deployment'],
    'terraform': ['terraform', 'iac', 'infrastructure as code', 'aws', 'cloud', 'provisioning'],
    'linux': ['linux', 'bash', 'shell', 'kernel', 'ssh', 'networking', 'system administration']
  };

  const getKeywordsForSkill = (skillName: string): string[] => {
    const lower = skillName.toLowerCase().trim();
    if (synonymsMap[lower]) return synonymsMap[lower];

    const tokens = lower
      .split(/[^a-zA-Z0-9+#]+/)
      .filter(w => w.length > 1 && !['and', 'with', 'for', 'the', 'system', 'systems', 'concepts'].includes(w));
    
    // Always include broad technical fallback tokens so unknown skills still match question bank items successfully!
    const baseTokens = tokens.length > 0 ? tokens : [lower];
    return [...baseTokens, 'software', 'development', 'architecture', 'engineering', 'backend'];
  };

  // Negative / Contradiction filter
  const isForbiddenQuestion = (item: QuestionBankItem): boolean => {
    const rawSkill = (item.skill || '').toLowerCase();
    const subTopic = (item.subTopic || '').toLowerCase();
    const itemQ = (item.question || '').toLowerCase();

    // 1. If user does NOT want frontend / full stack / UI:
    const wantsFrontend = ['full stack', 'fullstack', 'frontend', 'front end', 'ui', 'react', 'angular', 'vue'].some(k => combinedSkillsLower.includes(k));
    if (!wantsFrontend) {
      if (
        rawSkill.includes('full stack') ||
        rawSkill.includes('react') ||
        rawSkill.includes('angular') ||
        rawSkill.includes('vue') ||
        rawSkill.startsWith('ui-') ||
        rawSkill === 'ui/ux' ||
        subTopic.includes('full stack') ||
        subTopic.includes('react') ||
        subTopic.includes('angular')
      ) {
        return true;
      }
    }

    // 2. If user does NOT want Agile / Scrum:
    const wantsAgile = ['agile', 'scrum', 'kanban', 'sprint'].some(k => combinedSkillsLower.includes(k));
    if (!wantsAgile) {
      if (
        rawSkill.includes('agile') ||
        rawSkill.includes('scrum') ||
        subTopic.includes('agile') ||
        subTopic.includes('scrum') ||
        subTopic.includes('sprint ceremony')
      ) {
        return true;
      }
    }

    // 3. If user does NOT want Project Management / Business Analysis:
    const wantsPM = ['project management', 'business analysis', 'product manager'].some(k => combinedSkillsLower.includes(k));
    if (!wantsPM) {
      if (
        rawSkill.includes('project management') ||
        rawSkill.includes('business analysis')
      ) {
        return true;
      }
    }

    return false;
  };

  // Score an item against a specific skill (Hybrid: Rule-based keywords + Vector Cosine Similarity)
  const scoreItemForSkill = (item: QuestionBankItem, skillName: string): number => {
    const keywords = getKeywordsForSkill(skillName);
    const subLower = (item.subTopic || '').toLowerCase();
    const skillLower = (item.skill || '').toLowerCase();
    const qLower = (item.question || '').toLowerCase();

    let ruleScore = 0;
    for (const kw of keywords) {
      if (subLower.includes(kw)) ruleScore += 20;
      if (skillLower.includes(kw)) ruleScore += 15;
      if (qLower.includes(kw)) ruleScore += 5;
    }

    let vectorScore = 0;
    if (item.embedding && skillEmbeddings.has(skillName)) {
      const sim = cosineSimilarity(item.embedding, skillEmbeddings.get(skillName)!);
      vectorScore = Math.max(0, sim * 40);
    }

    return ruleScore + vectorScore;
  };

  // Shuffle helper
  const shuffleArray = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Filter pools
  const techPool = bankItems.filter(i => 
    (i.category === 'Technical' || i.category === 'HR' || i.category === 'Behavioral') &&
    !isForbiddenQuestion(i)
  );

  const codingPool = bankItems.filter(i => i.category === 'Coding');

  // --- SELECT TECHNICAL QUESTIONS WITH MANDATORY & GOOD-TO-HAVE ALLOCATION ---
  const selectedTechMap: { item: QuestionBankItem; targetedSkill: string; score: number; isGoodToHave: boolean }[] = [];
  const usedQuestionIds = new Set<string>();

  const goodTechCount = cleanGood.length > 0 ? Math.min(6, Math.max(2, Math.round(targetTechCount * 0.12))) : 0;
  const mandatoryTechCount = targetTechCount - goodTechCount;

  // 1. Mandatory Skills Quota
  if (cleanMandatory.length > 0) {
    const quotaPerMandatory = Math.floor(mandatoryTechCount / cleanMandatory.length);
    const extraMandatory = mandatoryTechCount % cleanMandatory.length;

    cleanMandatory.forEach((skillName, idx) => {
      const targetQuota = quotaPerMandatory + (idx < extraMandatory ? 1 : 0);
      const scoredList: { item: QuestionBankItem; score: number }[] = [];

      techPool.forEach(item => {
        if (usedQuestionIds.has(item.id)) return;
        const score = scoreItemForSkill(item, skillName);
        if (score > 0) scoredList.push({ item, score });
      });

      scoredList.sort((a, b) => b.score - a.score || (Math.random() - 0.5));
      const chosen = scoredList.slice(0, targetQuota);
      chosen.forEach(c => {
        usedQuestionIds.add(c.item.id);
        selectedTechMap.push({
          item: c.item,
          targetedSkill: skillName,
          score: c.score,
          isGoodToHave: false
        });
      });
    });
  }

  // 2. Good-to-Have Skills Quota (rare frequency)
  if (cleanGood.length > 0 && goodTechCount > 0) {
    const quotaPerGood = Math.floor(goodTechCount / cleanGood.length);
    const extraGood = goodTechCount % cleanGood.length;

    cleanGood.forEach((skillName, idx) => {
      const targetQuota = quotaPerGood + (idx < extraGood ? 1 : 0);
      const scoredList: { item: QuestionBankItem; score: number }[] = [];

      techPool.forEach(item => {
        if (usedQuestionIds.has(item.id)) return;
        const score = scoreItemForSkill(item, skillName);
        if (score > 0) scoredList.push({ item, score });
      });

      scoredList.sort((a, b) => b.score - a.score || (Math.random() - 0.5));
      const chosen = scoredList.slice(0, targetQuota);
      chosen.forEach(c => {
        usedQuestionIds.add(c.item.id);
        selectedTechMap.push({
          item: c.item,
          targetedSkill: skillName,
          score: c.score,
          isGoodToHave: true
        });
      });
    });
  }

  // If some skills had fewer matches than targetQuota, fill remaining from techPool
  if (selectedTechMap.length < targetTechCount) {
    const remainingNeeded = targetTechCount - selectedTechMap.length;
    const remainingCandidates: { item: QuestionBankItem; bestSkill: string; score: number; isGood: boolean }[] = [];

    techPool.forEach(item => {
      if (usedQuestionIds.has(item.id)) return;
      let bestSkill = cleanMandatory[0] || cleanGood[0] || 'General';
      let bestScore = 0;
      let isGood = false;

      for (const sk of cleanMandatory) {
        const sc = scoreItemForSkill(item, sk);
        if (sc > bestScore) {
          bestScore = sc;
          bestSkill = sk;
          isGood = false;
        }
      }
      for (const sk of cleanGood) {
        const sc = scoreItemForSkill(item, sk);
        if (sc > bestScore) {
          bestScore = sc;
          bestSkill = sk;
          isGood = true;
        }
      }

      if (bestScore > 0) {
        remainingCandidates.push({ item, bestSkill, score: bestScore, isGood });
      }
    });

    remainingCandidates.sort((a, b) => b.score - a.score || (Math.random() - 0.5));
    const extraPicks = remainingCandidates.slice(0, remainingNeeded);
    extraPicks.forEach(p => {
      usedQuestionIds.add(p.item.id);
      selectedTechMap.push({
        item: p.item,
        targetedSkill: p.bestSkill,
        score: p.score,
        isGoodToHave: p.isGood
      });
    });
  }

  // --- SELECT CODING QUESTIONS IN TARGET PROGRAMMING LANGUAGE ---
  let targetLang = 'Java';
  const langMatch = ['java', 'python', 'c#', 'c++', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'sql', 'scala'].find(l => combinedSkillsLower.includes(l));
  if (langMatch) {
    if (langMatch === 'java') targetLang = 'Java';
    else if (langMatch === 'python') targetLang = 'Python';
    else if (langMatch === 'c#' || combinedSkillsLower.includes('.net')) targetLang = 'C# / .NET';
    else if (langMatch === 'c++') targetLang = 'C++';
    else if (langMatch === 'sql') targetLang = 'SQL';
    else if (langMatch === 'javascript') targetLang = 'JavaScript';
    else if (langMatch === 'typescript') targetLang = 'TypeScript';
  }

  let matchedCoding = codingPool.filter(c => (c.skill || '').toLowerCase() === targetLang.toLowerCase());
  if (matchedCoding.length === 0) {
    matchedCoding = codingPool.filter(c => (c.skill || '').toLowerCase().includes(targetLang.toLowerCase()));
  }
  if (matchedCoding.length === 0) {
    matchedCoding = codingPool;
  }

  const selectedCodingItems = shuffleArray(matchedCoding).slice(0, targetCodingCount);

  // --- APPLY ADAPTIVE DIFFICULTY PROGRESSION ---
  const techEasy = shuffleArray(selectedTechMap.filter(m => (m.item.difficulty || '').toLowerCase() === 'easy'));
  const techModerate = shuffleArray(selectedTechMap.filter(m => (m.item.difficulty || '').toLowerCase() === 'moderate'));
  const techHigh = shuffleArray(selectedTechMap.filter(m => {
    const d = (m.item.difficulty || '').toLowerCase();
    return d === 'difficult' || d === 'high';
  }));

  const orderedTech: { item: QuestionBankItem; targetedSkill: string; isGoodToHave: boolean }[] = [];
  const totalTech = selectedTechMap.length;

  for (let i = 0; i < totalTech; i++) {
    const progress = i / totalTech;
    let probEasy = 0.60;
    let probMod = 0.30;
    if (progress >= 0.25 && progress < 0.75) {
      probEasy = 0.15;
      probMod = 0.70;
    } else if (progress >= 0.75) {
      probEasy = 0.10;
      probMod = 0.35;
    }

    const r = Math.random();
    let pref: 'Easy' | 'Moderate' | 'High' = 'Moderate';
    if (r < probEasy) pref = 'Easy';
    else if (r < probEasy + probMod) pref = 'Moderate';
    else pref = 'High';

    const tryOrder: ('Easy' | 'Moderate' | 'High')[] = pref === 'Easy' ? ['Easy', 'Moderate', 'High'] : (pref === 'High' ? ['High', 'Moderate', 'Easy'] : ['Moderate', 'Easy', 'High']);
    let pick: { item: QuestionBankItem; targetedSkill: string; isGoodToHave: boolean } | undefined;

    for (const d of tryOrder) {
      if (d === 'Easy' && techEasy.length > 0) { pick = techEasy.pop(); break; }
      if (d === 'Moderate' && techModerate.length > 0) { pick = techModerate.pop(); break; }
      if (d === 'High' && techHigh.length > 0) { pick = techHigh.pop(); break; }
    }
    if (pick) orderedTech.push(pick);
  }

  // Format Tech Questions
  const finalTechQuestions: Question[] = orderedTech.map((qObj, idx) => {
    const rawDiff = (qObj.item.difficulty || 'Moderate').toLowerCase();
    let normDiff: 'Easy' | 'Moderate' | 'High' = 'Moderate';
    if (rawDiff === 'easy') normDiff = 'Easy';
    else if (rawDiff === 'difficult' || rawDiff === 'high') normDiff = 'High';

    return {
      id: `q-bank-tech-${qObj.item.id}-${Math.random().toString(36).substr(2, 6)}-${idx}`,
      category: 'tech',
      question: (qObj.item.question || '').replace(/^Role focus:\s*[^.]+\.\s*/i, '').trim(),
      difficulty: normDiff,
      targetedSkill: qObj.targetedSkill,
      suggestedAnswer: qObj.item.sampleAnswer || qObj.item.evaluationRubric || '',
      starterCode: qObj.item.starterCode || qObj.item.codeSnippet || '',
      testCases: qObj.item.testCases || [],
      isGoodToHave: qObj.isGoodToHave
    };
  });

  // Format Coding Questions
  const codingSkillsPool = allSkills.filter(s => 
    ['java', 'backend', 'distributed', 'algorithm', 'system', 'concurrency', 'data'].some(k => s.toLowerCase().includes(k))
  );
  const codingAssignedSkills = codingSkillsPool.length > 0 ? codingSkillsPool : allSkills;

  const finalCodingQuestions: Question[] = selectedCodingItems.map((item, idx) => {
    const rawDiff = (item.difficulty || 'Moderate').toLowerCase();
    let normDiff: 'Easy' | 'Moderate' | 'High' = 'Moderate';
    if (rawDiff === 'easy') normDiff = 'Easy';
    else if (rawDiff === 'difficult' || rawDiff === 'high') normDiff = 'High';

    const assignedSkill = codingAssignedSkills[idx % codingAssignedSkills.length];

    return {
      id: `q-bank-code-${item.id}-${Math.random().toString(36).substr(2, 6)}-${idx}`,
      category: 'coding',
      question: item.question,
      difficulty: normDiff,
      targetedSkill: assignedSkill,
      suggestedAnswer: item.sampleAnswer || item.evaluationRubric || '',
      starterCode: item.starterCode || item.codeSnippet || '',
      testCases: item.testCases || []
    };
  });

  return [...finalTechQuestions, ...finalCodingQuestions];
}

/**
 * Core Assessment Question Generator: maps questions directly from Question Bank.
 */
export async function generateAssessmentQuestions(
  ai: GoogleGenAI | null,
  params: {
    title: string;
    roleLevel: string;
    experienceRequired: string;
    jdText: string;
    mandatorySkills?: string[];
    goodToHaveSkills?: string[];
  }
): Promise<Question[]> {
  const { title, roleLevel, experienceRequired, jdText, mandatorySkills = [], goodToHaveSkills = [] } = params;
  const db = getDb();

  const allSkills = Array.from(new Set(
    [...mandatorySkills, ...goodToHaveSkills]
      .filter(Boolean)
      .map(s => typeof s === 'string' ? s.trim() : String(s).trim())
      .filter(s => s.length > 0)
  ));
  if (allSkills.length === 0) {
    allSkills.push('Software Engineering', 'System Design', 'Algorithms', 'Databases', 'API Integration');
  }

  // Hybrid RAG Mode: Search and map questions directly from internal Question Bank first
  const bankMappedQuestions = await selectQuestionsFromQuestionBank(mandatorySkills, goodToHaveSkills, 50, 50);
  
  // Check which skills have questions mapped
  const matchedSkillsSet = new Set(bankMappedQuestions.map(q => (q.targetedSkill || '').toLowerCase()));
  const missingSkills = allSkills.filter(sk => !matchedSkillsSet.has(sk.toLowerCase()) && !Array.from(matchedSkillsSet).some(m => m.includes(sk.toLowerCase()) || sk.toLowerCase().includes(m)));

  let questions: Question[] = [...bankMappedQuestions];

  // If specific skills (e.g. PySpark) are completely missing from the question bank, generate ONLY for those gaps using AI
  if (missingSkills.length > 0 && (ai || isGroqConfigured())) {
    try {
      console.log(`[HYBRID RAG GAP-FILLING] Question bank had partial coverage. Generating real-time questions for missing skills:`, missingSkills);
      const prompt = `
      Generate 5 tailored technical interview questions for the specific missing skills: ${JSON.stringify(missingSkills)}, for role "${title}" (${roleLevel}).
      Output JSON format:
      {
        "questions": [
          { "category": "tech", "question": "...", "difficulty": "Moderate", "targetedSkill": "...", "suggestedAnswer": "..." }
        ]
      }`;
      const resp = await generateContentWithFallback(ai, {
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = cleanAndParseJSON(resp.text);
      const generatedGaps = (parsed.questions || []).map((q: any, i: number) => ({
        id: `q-gap-${Date.now()}-${i}`,
        category: 'tech' as const,
        question: q.question,
        difficulty: (q.difficulty === 'High' ? 'High' : (q.difficulty || 'Moderate')) as 'Easy' | 'Moderate' | 'High',
        targetedSkill: q.targetedSkill || missingSkills[0],
        suggestedAnswer: q.suggestedAnswer || ''
      }));

      // Self-Healing Persistence: Save generated gap questions permanently into db.questionBank so they are never missing again!
      if (!db.questionBank) db.questionBank = [];
      generatedGaps.forEach(g => {
        db.questionBank!.push({
          id: `bank-gen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          skill: g.targetedSkill || 'General',
          skillCategory: 'Custom Generated',
          difficulty: g.difficulty === 'High' ? 'Difficult' : g.difficulty,
          category: 'Technical',
          question: g.question,
          sampleAnswer: g.suggestedAnswer,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'manual'
        });
      });
      saveDb(db, true);

      questions.push(...generatedGaps);
    } catch (err) {
      console.warn('[HYBRID RAG GAP-FILLING] Gap generation fallback error:', err);
    }
  }

  // Pad remaining if needed from question bank
  while (questions.length < 50) {
    const fallbackItem = db.questionBank?.[questions.length % (db.questionBank?.length || 1)];
    if (fallbackItem) {
      questions.push({
        id: `q-pad-${Date.now()}-${questions.length}`,
        category: 'tech',
        question: fallbackItem.question,
        difficulty: 'Moderate',
        targetedSkill: allSkills[questions.length % allSkills.length],
        suggestedAnswer: fallbackItem.sampleAnswer || fallbackItem.evaluationRubric || ''
      });
    } else {
      break;
    }
  }

  console.log(`[HYBRID RAG SUMMARY] Assessment generated successfully. Total questions: ${questions.length}.`);
  return questions;
}

/**
 * Merges and deduplicates question bank items by normalized skill and question text.
 */
export function mergeDuplicateQuestionsInBank(db: DbStore): void {
  if (!db.questionBank || !Array.isArray(db.questionBank)) return;
  const seen = new Map<string, QuestionBankItem>();
  const uniqueItems: QuestionBankItem[] = [];

  for (const item of db.questionBank) {
    const normSkill = (item.skill || 'General').trim().toLowerCase();
    const normQ = (item.question || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const key = `${normSkill}:::${normQ}`;

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if (!existing.sampleAnswer && item.sampleAnswer) {
        existing.sampleAnswer = item.sampleAnswer;
      }
      if (!existing.evaluationRubric && item.evaluationRubric) {
        existing.evaluationRubric = item.evaluationRubric;
      }
    } else {
      seen.set(key, item);
      uniqueItems.push(item);
    }
  }

  if (uniqueItems.length < db.questionBank.length) {
    console.log(`[QUESTION BANK DEDUPLICATION] Merged ${db.questionBank.length - uniqueItems.length} duplicate questions. Clean bank size: ${uniqueItems.length}`);
    db.questionBank = uniqueItems;
  }
}

