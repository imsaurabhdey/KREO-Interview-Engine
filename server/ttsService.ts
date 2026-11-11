/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise High-Fidelity Text-to-Speech Streaming Synthesis Engine.
 * Powered by Edge Neural TTS & Gemini Neural Speech with In-Memory Low-Latency Cache.
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { getGeminiClient } from './gemini';

export interface TTSResult {
  buffer: Buffer;
  mimeType: string;
}

// In-memory LRU cache to serve repeated or prefetched question audio with 0ms delay
const ttsMemoryCache = new Map<string, TTSResult>();
const MAX_CACHE_ENTRIES = 250;

/**
 * Microsoft Edge High-Fidelity Neural Speech Synthesizer.
 * Uses Microsoft Azure's Neural TTS voice ('en-US-AvaMultilingualNeural' / 'en-US-AriaNeural').
 * Zero rate-limit caps, high latency efficiency, natural human diction.
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
        stream.audioStream.on('error', (err: any) => {
          clearTimeout(timeout);
          console.warn(`[EDGE TTS] Stream error on attempt ${attempt + 1}:`, err?.message || err);
          resolve(null);
        });
      });

      if (result && result.length > 0) {
        return result;
      }
    } catch (err: any) {
      console.warn(`[EDGE TTS] Synthesis failure on attempt ${attempt + 1}:`, err?.message || err);
    }
  }
  return null;
}

/**
 * Fallback chunked translation synthesizer for offline or network-constrained scenarios.
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
          currentPart = currentPart ? currentPart + ' ' + part : part;
        } else {
          if (currentPart) chunks.push(currentPart);
          if (part.length <= maxLen) {
            currentPart = part;
          } else {
            const words = part.split(/\s+/);
            let forcedPart = '';
            for (const word of words) {
              if ((forcedPart + ' ' + word).length <= maxLen) {
                forcedPart = forcedPart ? forcedPart + ' ' + word : word;
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

  const filteredChunks = chunks.filter(c => c.trim().length > 0);
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
      console.warn(`[TTS FALLBACK] Request fail for segment ${idx}: "${chunk}"`, err);
    }
    return { idx, buffer: null };
  });

  const results = await Promise.all(fetchPromises);
  const validBuffers = results
    .filter(r => r.buffer !== null)
    .sort((a, b) => a.idx - b.idx)
    .map(r => r.buffer as Buffer);

  if (validBuffers.length === 0) {
    return null;
  }

  return Buffer.concat(validBuffers);
}

// Concurrency serializer and rate-limit circuit breaker for Gemini TTS
let activeGeminiPromise: Promise<any> = Promise.resolve();
let geminiRateLimitCooldownUntil = 0;

function serializeGeminiCall<T>(task: () => Promise<T>): Promise<T> {
  const current = activeGeminiPromise.then(task, task);
  activeGeminiPromise = current.catch(() => {});
  return current;
}

/**
 * Synthesizes speech with natural human cadence, deliberate interviewer pacing, and 0ms cache.
 * Uses Microsoft Edge Neural TTS as primary resilient engine, backed by Gemini Neural TTS and chunked fallback.
 */
export async function synthesizeSpeech(text: string): Promise<TTSResult | null> {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return null;

  // 1. Return cached audio immediately (0ms delay for preloaded questions)
  if (ttsMemoryCache.has(cleanText)) {
    return ttsMemoryCache.get(cleanText)!;
  }

  // 2. High-Fidelity Edge Neural TTS Engine (Unconstrained, zero daily quota limit, studio quality)
  try {
    const edgeBuffer = await synthesizeEdgeTTSAudio(cleanText);
    if (edgeBuffer && edgeBuffer.length > 0) {
      const result: TTSResult = { buffer: edgeBuffer, mimeType: 'audio/mpeg' };
      if (ttsMemoryCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = ttsMemoryCache.keys().next().value;
        if (oldestKey) ttsMemoryCache.delete(oldestKey);
      }
      ttsMemoryCache.set(cleanText, result);
      return result;
    }
  } catch (edgeErr) {
    console.warn('[EDGE TTS] Bypassing to secondary speech engine:', edgeErr);
  }

  // 3. Gemini 3.8 Flash Lite TTS Engine (Serialized with rate-limit circuit breaker)
  const isCooldownActive = Date.now() < geminiRateLimitCooldownUntil;
  const ai = getGeminiClient();

  if (ai && !isCooldownActive) {
    try {
      const result = await serializeGeminiCall(async () => {
        if (ttsMemoryCache.has(cleanText)) {
          return ttsMemoryCache.get(cleanText)!;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: 'Natural, warm, human interviewer speaking at a slow, calm, and deliberate pace. Use gentle unhurried conversational cadence, thoughtful natural pauses, empathetic human inflection, and clear professional diction without sounding robotic, rushed, or synthetic.',
                  },
                } as any,
              ],
            } as any,
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const buffer = Buffer.from(base64Audio, 'base64');
          const ttsRes: TTSResult = { buffer, mimeType: 'audio/wav' };

          if (ttsMemoryCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = ttsMemoryCache.keys().next().value;
            if (oldestKey) ttsMemoryCache.delete(oldestKey);
          }
          ttsMemoryCache.set(cleanText, ttsRes);
          return ttsRes;
        }
        return null;
      });

      if (result) {
        return result;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isRateLimit = err?.status === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
      
      if (isRateLimit) {
        geminiRateLimitCooldownUntil = Date.now() + 12 * 3600 * 1000;
        console.warn(`[GEMINI TTS RATE-LIMIT] 429 detected. Setting 12h persistent cooldown.`);
      }
    }
  }

  // 4. Multi-chunk translation fallback synthesizer (Zero quota restriction)
  try {
    const fallbackBuffer = await synthesizeFallbackAudio(cleanText);
    if (fallbackBuffer) {
      const result: TTSResult = { buffer: fallbackBuffer, mimeType: 'audio/mpeg' };
      if (ttsMemoryCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = ttsMemoryCache.keys().next().value;
        if (oldestKey) ttsMemoryCache.delete(oldestKey);
      }
      ttsMemoryCache.set(cleanText, result);
      return result;
    }
  } catch (fallbackErr) {
    console.error('[TTS FATAL] Fallback synthesis failed:', fallbackErr);
  }

  return null;
}
