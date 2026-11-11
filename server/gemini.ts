/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Gemini AI Client & Multi-Model Rate-Limit Fallback Service.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { generateWithGroqFallback, isGroqConfigured } from './groq';

export { isGroqConfigured };

/**
 * Lazy loads the Gemini Client to prevent server boot crashing when the key is not set.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.includes('YOUR_')) {
    console.warn('[GEMINI] API Key missing/default. Offline fallback logic active.');
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

/**
 * Global tracker for rate-limited models to allow instant bypass and fallback routing.
 */
export const modelCooldowns = new Map<string, number>();
const GLOBAL_COOLDOWN_MS = 20 * 1000; // 20 seconds cooldown on rate limits

/**
 * Gets an optimal sequence of text models to try, prioritizing those not on active cooldown.
 */
export function getOptimalModelSequence(requestedModel: string): string[] {
  const allModels = [
    requestedModel,
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ];
  const uniqueModels = allModels.filter((v, i, a) => a.indexOf(v) === i);
  const now = Date.now();

  uniqueModels.sort((a, b) => {
    const cooldownA = modelCooldowns.get(a) || 0;
    const cooldownB = modelCooldowns.get(b) || 0;
    
    const isAOnCooldown = cooldownA > now;
    const isBOnCooldown = cooldownB > now;
    
    if (isAOnCooldown && !isBOnCooldown) return 1;
    if (!isAOnCooldown && isBOnCooldown) return -1;
    if (isAOnCooldown && isBOnCooldown) {
      return cooldownA - cooldownB; // Prefer the one whose cooldown expires sooner
    }
    
    if (a === requestedModel) return -1;
    if (b === requestedModel) return 1;
    return 0;
  });

  return uniqueModels;
}

/**
 * Safely executes a Gemini API call with adaptive exponential retries for transient errors (e.g. 503, 429).
 */
export async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = String(error).toLowerCase();
    const isTransient =
      error?.status === 503 ||
      error?.status === 429 ||
      error?.status === 500 ||
      errorStr.includes('503') ||
      errorStr.includes('429') ||
      errorStr.includes('unavailable') ||
      errorStr.includes('service unavailable') ||
      errorStr.includes('resource exhausted') ||
      errorStr.includes('resource_exhausted') ||
      errorStr.includes('busy') ||
      errorStr.includes('limit');

    if (isTransient && retries > 0) {
      console.warn(`[GEMINI] Transient error detected. Retrying in ${delay}ms... (${retries} attempts left).`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callGeminiWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Helper to robustly clean and parse JSON from Gemini text output.
 */
export function cleanAndParseJSON(text: string | undefined | null): any {
  if (!text) return {};
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Try to find the first '{' and last '}' to extract the JSON object
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        const sliced = cleaned.substring(startIdx, endIdx + 1);
        return JSON.parse(sliced);
      } catch (innerErr) {
        // Continue to array check
      }
    }
    // Try to find the first '[' and last ']' if it's an array
    const startArrIdx = cleaned.indexOf('[');
    const endArrIdx = cleaned.lastIndexOf(']');
    if (startArrIdx !== -1 && endArrIdx !== -1 && endArrIdx > startArrIdx) {
      try {
        const sliced = cleaned.substring(startArrIdx, endArrIdx + 1);
        return JSON.parse(sliced);
      } catch (innerErr) {
        // Fall through
      }
    }
    throw err;
  }
}

/**
 * Extracts plain text from various Gemini content parameter formats.
 */
export function extractPromptText(contents: any): string {
  if (!contents) return '';
  if (typeof contents === 'string') return contents;
  if (Array.isArray(contents)) {
    return contents.map((c: any) => {
      if (typeof c === 'string') return c;
      if (c?.text) return c.text;
      if (c?.parts && Array.isArray(c.parts)) {
        return c.parts.map((p: any) => p?.text || '').join('\n');
      }
      return JSON.stringify(c);
    }).join('\n');
  }
  if (contents?.parts && Array.isArray(contents.parts)) {
    return contents.parts.map((p: any) => p?.text || '').join('\n');
  }
  if (contents?.text) return contents.text;
  return JSON.stringify(contents);
}

/**
 * Invokes Gemini content generation with multi-model fallback in case of rate limits or transient errors.
 * If Gemini models are exhausted or key is missing, automatically cascades to Groq (Llama 3.3 70B / 3.1 8B).
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI | null,
  params: {
    contents: any;
    config?: any;
    model?: string;
  }
): Promise<any> {
  const requestedModel = params.model || 'gemini-3.5-flash';
  let lastError: any = null;

  // Tier 1: Try Gemini models sequence if client is initialized
  if (ai) {
    const modelsToTry = getOptimalModelSequence(requestedModel);

    for (let idx = 0; idx < modelsToTry.length; idx++) {
      const currentModel = modelsToTry[idx];
      try {
        const response = await callGeminiWithRetry(async () => {
          return await ai.models.generateContent({
            ...params,
            model: currentModel
          });
        }, 2, 800);
        
        return response;
      } catch (err: any) {
        const isRateLimit =
          String(err).includes('429') ||
          String(err).toLowerCase().includes('quota') ||
          String(err).toLowerCase().includes('resource_exhausted');
        
        if (isRateLimit) {
          modelCooldowns.set(currentModel, Date.now() + GLOBAL_COOLDOWN_MS);
        }

        console.warn(`[GEMINI] Model "${currentModel}" failed: ${err?.message || err}. Attempting fallback...`);
        lastError = err;
      }
    }
  }

  // Tier 2: Groq Inference Engine Fallback (Llama 3.3 70B -> Llama 3.1 8B Instant)
  if (isGroqConfigured()) {
    try {
      console.log('[AI FALLBACK] Gemini models unavailable or exhausted. Seamlessly routing to Groq...');
      const promptText = extractPromptText(params.contents);
      const isJson =
        params.config?.responseMimeType === 'application/json' ||
        Boolean(params.config?.responseSchema) ||
        promptText.toLowerCase().includes('json');

      const systemPrompt = params.config?.systemInstruction
        ? extractPromptText(params.config.systemInstruction)
        : undefined;

      const groqResult = await generateWithGroqFallback(promptText, {
        jsonMode: isJson,
        systemPrompt,
        temperature: params.config?.temperature ?? 0.2
      });

      // Wrap output in standard format identical to Gemini response object
      return {
        text: groqResult,
        candidates: [
          {
            content: {
              parts: [{ text: groqResult }]
            }
          }
        ]
      };
    } catch (groqErr: any) {
      console.error('[AI FALLBACK] Groq fallback error:', groqErr.message || groqErr);
      lastError = groqErr;
    }
  }

  throw lastError || new Error('All AI models (Gemini and Groq) exhausted');
}

/**
 * Evaluates whether a candidate's answer is vague/incomplete and requires a cross-question follow-up.
 */
export async function evaluateNeedsFollowUp(
  ai: GoogleGenAI | null,
  questionText: string,
  candidateAnswer: string,
  category: string,
  questionId: string
): Promise<{ needsFollowUp: boolean; followUpText: string }> {
  const answerStr = candidateAnswer ? candidateAnswer.trim() : '';
  const words = answerStr.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Rule 1: Extremely short answer (< 6 words) is immediately considered incomplete.
  if (wordCount < 6) {
    let followUpText = '';
    if (category === 'coding') {
      followUpText = 'Could you explain your algorithmic design choice and the big-O runtime complexity of your code?';
    } else {
      followUpText = 'Could you elaborate on the core concepts here and explain the scalability or trade-offs of this approach?';
    }
    return { needsFollowUp: true, followUpText };
  }

  // Rule 2: Semantic check with Gemini or Groq fallback
  if (ai || isGroqConfigured()) {
    try {
      const evaluationPrompt = `
You are Suri, an elite technical interviewer. Evaluate whether the candidate's answer to this question is complete, satisfactory, and demonstrates authentic understanding, or if it is vague, surface-level, dodging the question, or extremely incomplete.

Question Category: ${category}
Question Text: "${questionText}"
Candidate's Answer: "${answerStr}"

Rules for Evaluation:
1. If the candidate's answer is reasonably clear, comprehensive, and directly addresses the core question, return:
   { "needsFollowUp": false, "reason": "Complete and satisfactory", "followUpText": "" }
2. If the candidate's answer is vague (e.g., "use Python because it is fast"), leaves out key mechanisms, sounds hand-wavy, or avoids explaining the "how" and "why", return:
   { "needsFollowUp": true, "reason": "Answer is vague or lacks depth", "followUpText": "A direct, custom 1-sentence follow-up question to probe their understanding of the specific details, architectural trade-offs, or corner cases of their answer." }
3. DO NOT trigger follow-ups on high-quality answers. Keep followUpText limited to exactly 1 sentence.

Output strictly in JSON matching the schema.`;

      const response = await generateContentWithFallback(ai, {
        contents: evaluationPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              needsFollowUp: { type: Type.BOOLEAN },
              reason: { type: Type.STRING },
              followUpText: { type: Type.STRING }
            },
            required: ['needsFollowUp', 'reason', 'followUpText']
          }
        }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (typeof parsed.needsFollowUp === 'boolean') {
        return {
          needsFollowUp: parsed.needsFollowUp,
          followUpText: parsed.followUpText || ''
        };
      }
    } catch (err) {
      console.warn('[SMART-FOLLOWUP] Gemini check failed or timed out. Falling back to heuristic word-count matching.', err);
    }
  }

  // Fallback Rule 3: Word-count heuristic with custom topic focus
  const threshold = category === 'coding' ? 12 : 18;
  if (wordCount < threshold) {
    let focus = 'this design choice';
    const qLower = questionText.toLowerCase();
    if (qLower.includes('useeffect')) {
      focus = 'the execution cycle of useEffect cleanup handlers and memory leaks';
    } else if (qLower.includes('dom') || qLower.includes('reconcil') || qLower.includes('render')) {
      focus = 'React fiber reconciliation, node repaints, and performance optimization';
    } else if (qLower.includes('context') || qLower.includes('redux') || qLower.includes('state') || qLower.includes('zustand')) {
      focus = 'state propagation pathways and avoiding excessive sub-tree re-renders';
    } else if (qLower.includes('event loop') || qLower.includes('nexttick') || qLower.includes('setimmediate')) {
      focus = 'event loop task queues and microtask scheduling priority';
    } else if (qLower.includes('performance') || qLower.includes('latency') || qLower.includes('cache')) {
      focus = 'data partitioning, runtime memoization, or network caching rules';
    } else {
      const architecturalKeywords = ['asynchronous', 'scalability', 'security', 'concurrency', 'middleware', 'database', 'pipeline', 'spark', 'etl'];
      const foundKeyword = architecturalKeywords.find(kw => qLower.includes(kw));
      if (foundKeyword) {
        focus = `best-practice patterns for maintaining high ${foundKeyword} at scale`;
      }
    }

    const codingFollowUps = [
      "Could you walk me through the big-O time complexity and resource trade-offs of your algorithm?",
      "How would you refactor this sandbox code to achieve a strictly O(1) space complexity or lock-free constraint?",
      "What corner cases or unexpected boundary conditions might cause this logic to throw an unhandled exception?",
      "If the input stream were infinite, how would you adapt this function to process blocks iteratively or in-memory chunking?",
      "Can you explain how to implement robust parallel execution safely over this routine?",
      "How would you write rigorous automated tests or simulate extreme load testing scenarios for this function?"
    ];

    const technicalFollowUps = [
      `In a real high-traffic production system, how would you address or optimize for ${focus}?`,
      `What are the direct memory footprints or latency overheads when adopting ${focus} under load?`,
      `Could you outline key metrics or logging strategies you would place to trace or monitor ${focus}?`,
      `What is the absolute weakest edge-case of ${focus} where this pattern fails or bottleneck starts?`,
      `How would your team write custom load-tests to identify the concrete boundaries/limits of ${focus}?`
    ];

    const wordSum = (questionId || '').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const list = category === 'coding' ? codingFollowUps : technicalFollowUps;
    const idx = wordSum % list.length;
    return { needsFollowUp: true, followUpText: list[idx] };
  }

  return { needsFollowUp: false, followUpText: '' };
}
