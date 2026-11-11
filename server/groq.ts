/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Groq Inference Engine & Multi-Tier Fallback Service.
 * Provides high-speed, generous rate-limit fallback when primary Gemini models face quotas or latency.
 */

export interface GroqGenerationOptions {
  jsonMode?: boolean;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export const groqModelCooldowns = new Map<string, number>();
const GROQ_COOLDOWN_MS = 15 * 1000; // 15 seconds cooldown on 429

/**
 * Returns true if GROQ_API_KEY is configured and not a placeholder.
 */
export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return Boolean(
    key &&
    key !== 'MY_GROQ_API_KEY' &&
    !key.includes('YOUR_') &&
    key.trim().length > 10
  );
}

/**
 * Returns ordered list of Groq models to try, prioritizing those not on active cooldown.
 * 1. llama-3.3-70b-versatile (Highest reasoning quality & JSON precision, 128k context)
 * 2. llama-3.1-8b-instant (Highest free-tier RPM/TPM allowance, ultra-fast 800+ tok/s)
 * 3. mixtral-8x7b-32768 (MoE high-capacity backup)
 */
export function getOptimalGroqModels(): string[] {
  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768'
  ];
  const now = Date.now();

  return models.sort((a, b) => {
    const cooldownA = groqModelCooldowns.get(a) || 0;
    const cooldownB = groqModelCooldowns.get(b) || 0;
    const isAOnCooldown = cooldownA > now;
    const isBOnCooldown = cooldownB > now;

    if (isAOnCooldown && !isBOnCooldown) return 1;
    if (!isAOnCooldown && isBOnCooldown) return -1;
    if (isAOnCooldown && isBOnCooldown) return cooldownA - cooldownB;
    return 0;
  });
}

/**
 * Executes chat completion request against Groq OpenAI-compatible endpoint.
 */
async function callGroqAPI(
  apiKey: string,
  model: string,
  prompt: string,
  options?: GroqGenerationOptions
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  const payload: any = {
    model,
    messages,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 4096
  };

  if (options?.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'kreo-ai-enterprise/1.0'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err: any = new Error(`Groq API returned HTTP ${response.status}: ${errorText}`);
    err.status = response.status;
    err.body = errorText;
    throw err;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned empty completion content');
  }

  return content;
}

/**
 * Cascading Groq generation across available models with cooldown management.
 */
export async function generateWithGroqFallback(
  prompt: string,
  options?: GroqGenerationOptions
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || !isGroqConfigured()) {
    throw new Error('Groq API Key is missing or not configured');
  }

  const modelsToTry = getOptimalGroqModels();
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[GROQ FALLBACK] Executing request using model: ${model}`);
      const result = await callGroqAPI(apiKey, model, prompt, options);
      console.log(`[GROQ FALLBACK] Successfully generated response via ${model}`);
      return result;
    } catch (err: any) {
      const isRateLimit =
        err?.status === 429 ||
        String(err).includes('429') ||
        String(err).toLowerCase().includes('rate_limit') ||
        String(err).toLowerCase().includes('tokens per minute');

      if (isRateLimit) {
        console.warn(`[GROQ] Model ${model} hit rate limit. Setting cooldown for ${GROQ_COOLDOWN_MS / 1000}s`);
        groqModelCooldowns.set(model, Date.now() + GROQ_COOLDOWN_MS);
      } else {
        console.warn(`[GROQ] Model ${model} failed: ${err.message || err}`);
      }

      lastError = err;
    }
  }

  throw lastError || new Error('All Groq fallback models exhausted');
}
