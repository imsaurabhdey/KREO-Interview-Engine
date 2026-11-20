/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise High-Fidelity Text-to-Speech Streaming Synthesis Engine.
 * Powered by Edge Neural TTS & Gemini Neural Speech with In-Memory Low-Latency Cache.
 */

import { GoogleGenAI } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export interface TTSResult {
  buffer: Buffer;
  mimeType: string;
}

// In-memory LRU cache to serve repeated or prefetched question audio with 0ms delay
const ttsMemoryCache = new Map<string, TTSResult>();
const MAX_CACHE_ENTRIES = 250;

/**
 * Shared LRU cache helper used across all TTS providers.
 */
function setCachedTts(cacheKey: string, result: TTSResult): TTSResult {
  if (ttsMemoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = ttsMemoryCache.keys().next().value;
    if (oldestKey) {
      ttsMemoryCache.delete(oldestKey);
    }
  }
  ttsMemoryCache.set(cacheKey, result);
  return result;
}

/**
 * Dedicated Gemini TTS client using v1beta API version (required for speechConfig & speechMetadata).
 */
function getGeminiTtsClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.includes('YOUR_')) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

/**
 * Microsoft Edge High-Fidelity Neural Speech Synthesizer.
 * Uses Microsoft Azure's Neural TTS voice ('en-US-AvaMultilingualNeural').
 */
async function synthesizeEdgeTTSAudio(cleanText: string, maxRetries = 1): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata('en-US-AvaMultilingualNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const stream = tts.toStream(cleanText);

      const chunks: Buffer[] = [];
      const result = await new Promise<Buffer | null>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`[EDGE TTS] Timeout reached (6s) on attempt ${attempt + 1}.`);
          resolve(null);
        }, 6000);

        stream.audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.audioStream.on('end', () => {
          clearTimeout(timeout);
          const fullBuffer = Buffer.concat(chunks);
          resolve(fullBuffer.length > 0 ? fullBuffer : null);
        });
        stream.audioStream.on('error', (err: unknown) => {
          clearTimeout(timeout);
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[EDGE TTS] Stream error on attempt ${attempt + 1}:`, msg);
          resolve(null);
        });
      });

      if (result && result.length > 0) {
        return result;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[EDGE TTS] Synthesis failure on attempt ${attempt + 1}:`, msg);
    }
  }
  return null;
}

/**
 * Fallback chunked translation synthesizer for network-constrained scenarios.
 */
async function synthesizeFallbackAudio(cleanText: string): Promise<Buffer | null> {
  const maxLen = 180;
  const sentences = cleanText
    .replace(/\. \.\.\. /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.?!])\s+/);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxLen) {
      if (sentence) chunks.push(sentence);
    } else {
      const subParts = sentence.split(/(?<=[,;])\s+/);
      let currentPart = '';
      for (const part of subParts) {
        if ((currentPart + ' ' + part).length <= maxLen) {
          currentPart = currentPart ? `${currentPart} ${part}` : part;
        } else {
          if (currentPart) chunks.push(currentPart);
          if (part.length <= maxLen) {
            currentPart = part;
          } else {
            const words = part.split(/\s+/);
            let forcedPart = '';
            for (const word of words) {
              if ((forcedPart + ' ' + word).length <= maxLen) {
                forcedPart = forcedPart ? `${forcedPart} ${word}` : word;
              } else {
                if (forcedPart) chunks.push(forcedPart);
                forcedPart = word;
              }
            }
            currentPart = forcedPart;
          }
        }
      }
      if (currentPart) {
        chunks.push(currentPart);
      }
    }
  }

  const filteredChunks = chunks.filter((c) => c.trim().length > 0);
  if (filteredChunks.length === 0) {
    return null;
  }

  const fetchPromises = filteredChunks.map(async (chunk, idx) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return { idx, buffer: Buffer.from(arrayBuffer) };
      }
    } catch (err) {
      console.warn(`[TTS FALLBACK] Request fail for segment ${idx}:`, err instanceof Error ? err.message : err);
    }
    return { idx, buffer: null };
  });

  const results = await Promise.all(fetchPromises);
  const validBuffers = results
    .filter((r): r is { idx: number; buffer: Buffer } => r.buffer !== null)
    .sort((a, b) => a.idx - b.idx)
    .map((r) => r.buffer);

  if (validBuffers.length === 0) {
    return null;
  }

  return Buffer.concat(validBuffers);
}

// Concurrency serializer and cooldown circuit breaker for Gemini TTS
let activeGeminiPromise: Promise<unknown> = Promise.resolve();
let geminiRateLimitCooldownUntil = 0;

function serializeGeminiCall<T>(task: () => Promise<T>): Promise<T> {
  const current = activeGeminiPromise.then(task, task);
  activeGeminiPromise = current.catch(() => undefined);
  return current;
}

/**
 * Synthesizes speech with natural human cadence, deliberate interviewer pacing, and 0ms cache.
 * Uses Microsoft Edge Neural TTS as primary engine, backed by Gemini Neural TTS (v1beta) and chunked fallback.
 */
export async function synthesizeSpeech(text: string): Promise<TTSResult | null> {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return null;

  // 1. Return cached audio immediately
  const cached = ttsMemoryCache.get(cleanText);
  if (cached) {
    return cached;
  }

  // 2. Primary: Edge Neural TTS
  try {
    const edgeBuffer = await synthesizeEdgeTTSAudio(cleanText);
    if (edgeBuffer && edgeBuffer.length > 0) {
      return setCachedTts(cleanText, { buffer: edgeBuffer, mimeType: 'audio/mpeg' });
    }
  } catch (edgeErr) {
    console.warn('[EDGE TTS] Bypassing to secondary speech engine:', edgeErr);
  }

  // 3. Secondary: Gemini 3.8 Flash Lite TTS (v1beta required for speechConfig/speechMetadata)
  const isCooldownActive = Date.now() < geminiRateLimitCooldownUntil;
  const ai = getGeminiTtsClient();

  if (ai && !isCooldownActive) {
    try {
      const result = await serializeGeminiCall(async () => {
        const alreadyCached = ttsMemoryCache.get(cleanText);
        if (alreadyCached) return alreadyCached;

        let timerId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error('Gemini TTS timeout (10s)')), 10000);
        });

        let response: any;
        try {
          response = await Promise.race([
            ai.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: cleanText,
                      speechMetadata: {
                        style: 'Natural, warm, human interviewer speaking at a slow, calm, and deliberate pace. Use gentle unhurried conversational cadence, thoughtful natural pauses, empathetic human inflection, and clear professional diction without sounding robotic, rushed, or synthetic.'
                      }
                    } as any
                  ]
                }
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }
                  }
                }
              }
            }),
            timeoutPromise
          ]);
        } finally {
          if (timerId) clearTimeout(timerId);
        }

        const base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const buffer = Buffer.from(base64Audio, 'base64');
          return setCachedTts(cleanText, { buffer, mimeType: 'audio/wav' });
        }
        return null;
      });

      if (result) {
        return result;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isRateLimit = err?.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
      const isUnavailableOrInvalid =
        err?.status === 404 ||
        err?.status === 400 ||
        errMsg.includes('404') ||
        errMsg.includes('NOT_FOUND') ||
        errMsg.includes('INVALID_ARGUMENT');

      if (isRateLimit) {
        geminiRateLimitCooldownUntil = Date.now() + 12 * 3600 * 1000;
        console.warn('[GEMINI TTS RATE-LIMIT] 429 detected. Setting 12h cooldown.');
      } else if (isUnavailableOrInvalid) {
        geminiRateLimitCooldownUntil = Date.now() + 10 * 60 * 1000;
        console.warn(`[GEMINI TTS] Model/payload rejected (${errMsg}). Setting 10m cooldown.`);
      } else {
        console.warn('[GEMINI TTS] Error:', errMsg);
      }
    }
  }

  // 4. Tertiary: Multi-chunk fallback synthesizer
  try {
    const fallbackBuffer = await synthesizeFallbackAudio(cleanText);
    if (fallbackBuffer) {
      return setCachedTts(cleanText, { buffer: fallbackBuffer, mimeType: 'audio/mpeg' });
    }
  } catch (fallbackErr) {
    console.error('[TTS FATAL] Fallback synthesis failed:', fallbackErr);
  }

  return null;
}
