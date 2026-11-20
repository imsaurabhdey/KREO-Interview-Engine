/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise Code Sandbox Runner via Piston Engine.
 * Enforces language allowlists, payload size caps, execution timeouts, and output caps.
 */

export const MAX_CODE_BYTES = 20_000; // 20 KB max source code size
const MAX_OUTPUT_CHARS = 16_000; // 16 KB max stdout/stderr cap

export interface CodeExecutionResult {
  run?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  language?: string;
  version?: string;
  error?: string;
}

const LANGUAGE_MAP: Array<{ match: (lang: string) => boolean; pistonLang: string; ext: string }> = [
  { match: (l) => l === 'javascript' || l === 'js' || l === 'node' || l === 'nodejs', pistonLang: 'javascript', ext: 'js' },
  { match: (l) => l === 'typescript' || l === 'ts' || l.includes('react'), pistonLang: 'typescript', ext: 'ts' },
  { match: (l) => l === 'python' || l === 'py' || l === 'python3', pistonLang: 'python', ext: 'py' },
  { match: (l) => l === 'java', pistonLang: 'java', ext: 'java' },
  { match: (l) => l === 'c++' || l === 'cpp' || l === 'cplusplus', pistonLang: 'c++', ext: 'cpp' },
  { match: (l) => l === 'c#' || l === 'csharp' || l === 'dotnet' || l === '.net', pistonLang: 'csharp', ext: 'cs' },
  { match: (l) => l === 'sql' || l === 'sqlite' || l === 'sqlite3', pistonLang: 'sqlite3', ext: 'sql' },
  { match: (l) => l === 'go' || l === 'golang', pistonLang: 'go', ext: 'go' },
  { match: (l) => l === 'rust' || l === 'rs', pistonLang: 'rust', ext: 'rs' },
  { match: (l) => l === 'php', pistonLang: 'php', ext: 'php' }
];

export function resolveSupportedLanguage(language = 'javascript'): { pistonLang: string; ext: string } | null {
  const clean = String(language || 'javascript').toLowerCase().trim();
  const entry = LANGUAGE_MAP.find((item) => item.match(clean));
  return entry ? { pistonLang: entry.pistonLang, ext: entry.ext } : null;
}

function truncateOutput(text?: string): string {
  if (!text) return '';
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n... [output truncated at ${MAX_OUTPUT_CHARS} chars]`;
}

/**
 * Executes arbitrary candidate code in an isolated external Piston sandbox.
 * Note: Submitted code is transmitted to the external Piston runner (emkc.org) with no persistence.
 */
export async function executeCodeSandbox(code: string, language = 'javascript'): Promise<CodeExecutionResult> {
  if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES) {
    throw new Error(`Code exceeds maximum allowed size of ${MAX_CODE_BYTES} bytes.`);
  }

  const resolved = resolveSupportedLanguage(language);
  if (!resolved) {
    throw new Error(`Unsupported programming language: "${language}".`);
  }

  // 1. Dynamic runtime resolution (default '*' lets Piston select latest installed runtime)
  let resolvedVersion = '*';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const runtimesRes = await fetch('https://emkc.org/api/v2/piston/runtimes', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (runtimesRes.ok) {
      const runtimes = (await runtimesRes.json()) as Array<{ language: string; version: string; aliases: string[] }>;
      const match = runtimes.find(
        (r) =>
          r.language === resolved.pistonLang ||
          r.aliases.includes(resolved.pistonLang) ||
          r.language.startsWith(resolved.pistonLang)
      );
      if (match) {
        resolvedVersion = match.version;
      }
    }
  } catch (e) {
    console.warn('[PISTON_RUNTIMES] Dynamic runtime check bypassed, using fallback mapping.', e);
  }

  // 2. Post execution payload to Piston API with strict compile/run time limits
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  const executeRes = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: resolved.pistonLang,
      version: resolvedVersion,
      compile_timeout: 10000,
      run_timeout: 5000,
      files: [
        {
          name: `index.${resolved.ext}`,
          content: code
        }
      ],
      stdin: ''
    }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!executeRes.ok) {
    const errText = await executeRes.text();
    throw new Error(`Piston execution failed: ${errText}`);
  }

  const rawResult = (await executeRes.json()) as CodeExecutionResult;
  if (rawResult.run) {
    rawResult.run.stdout = truncateOutput(rawResult.run.stdout);
    rawResult.run.stderr = truncateOutput(rawResult.run.stderr);
    rawResult.run.output = truncateOutput(rawResult.run.output);
  }
  if (rawResult.compile) {
    rawResult.compile.stdout = truncateOutput(rawResult.compile.stdout);
    rawResult.compile.stderr = truncateOutput(rawResult.compile.stderr);
    rawResult.compile.output = truncateOutput(rawResult.compile.output);
  }

  return rawResult;
}
