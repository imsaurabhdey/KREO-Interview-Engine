/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Code Sandbox Runner via Piston Engine.
 */

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
  error?: string;
}

/**
 * Executes arbitrary candidate code in a secure sandboxed environment.
 */
export async function executeCodeSandbox(code: string, language = 'javascript'): Promise<CodeExecutionResult> {
  // 1. Dynamic runtime resolution
  let resolvedVersion = '18.15.0';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const runtimesRes = await fetch('https://emkc.org/api/v2/piston/runtimes', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (runtimesRes.ok) {
      const runtimes = await runtimesRes.json() as Array<{ language: string; version: string; aliases: string[] }>;
      const targetLang = language.toLowerCase();
      const match = runtimes.find(r => 
        r.language === targetLang || r.aliases.includes(targetLang) || r.language.startsWith(targetLang)
      );
      if (match) {
        resolvedVersion = match.version;
      }
    }
  } catch (e) {
    console.warn('[PISTON_RUNTIMES] Dynamic runtime check bypassed, using fallback mapping.', e);
  }

  // 2. Map file extension and official Piston runtime language names
  const langLower = language.toLowerCase().trim();
  let finalLangName = 'javascript';
  let ext = 'js';

  if (langLower.includes('python') || langLower === 'py') {
    finalLangName = 'python';
    ext = 'py';
  } else if (langLower.includes('java') && !langLower.includes('script')) {
    finalLangName = 'java';
    ext = 'java';
  } else if (langLower.includes('c++') || langLower.includes('cpp') || langLower.includes('cplusplus')) {
    finalLangName = 'c++';
    ext = 'cpp';
  } else if (langLower.includes('c#') || langLower.includes('csharp') || langLower.includes('dotnet') || langLower.includes('.net')) {
    finalLangName = 'csharp';
    ext = 'cs';
  } else if (langLower.includes('sql') || langLower.includes('sqlite')) {
    finalLangName = 'sqlite3';
    ext = 'sql';
  } else if (langLower.includes('typescript') || langLower === 'ts' || langLower.includes('react')) {
    finalLangName = 'typescript';
    ext = 'ts';
  } else if (langLower.includes('go') || langLower.includes('golang')) {
    finalLangName = 'go';
    ext = 'go';
  } else if (langLower.includes('rust') || langLower === 'rs') {
    finalLangName = 'rust';
    ext = 'rs';
  } else if (langLower.includes('php')) {
    finalLangName = 'php';
    ext = 'php';
  }

  // 3. Post execution payload to Piston API with 10s execution timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const executeRes = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: finalLangName,
      version: resolvedVersion,
      files: [
        {
          name: `index.${ext}`,
          content: code
        }
      ],
      stdin: ""
    }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!executeRes.ok) {
    const errText = await executeRes.text();
    throw new Error(`Piston execution failed: ${errText}`);
  }

  return await executeRes.json();
}
