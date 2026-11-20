/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Vector Embedding & Cosine Similarity Semantic Retrieval Service.
 * Leverages Google's gemini-embedding-001 model for zero-shot semantic matching
 * with local in-memory cosine similarity and persistent database caching.
 */

import { getGeminiClient } from './gemini';

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// In-memory embedding cache and failure circuit breaker to prevent repeated slow calls
const embeddingCache = new Map<string, number[]>();
const MAX_EMBEDDING_CACHE = 1000;
let embeddingCooldownUntil = 0;
const EMBEDDING_TIMEOUT_MS = 5000;

/**
 * Generates a vector embedding for input text using Google's gemini-embedding-2 model
 * with fallback, caching, and timeout protection.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  const normalized = (text || '').trim();
  if (!normalized) return null;

  const cacheKey = normalized.toLowerCase();
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  if (Date.now() < embeddingCooldownUntil) {
    return null;
  }

  const ai = getGeminiClient();
  if (!ai) return null;

  const modelsToTry = ['gemini-embedding-2', 'gemini-embedding-001'];
  for (const model of modelsToTry) {
    let timerId: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error(`Embedding timeout (${EMBEDDING_TIMEOUT_MS}ms)`)), EMBEDDING_TIMEOUT_MS);
      });

      const response = await Promise.race([
        ai.models.embedContent({
          model,
          contents: normalized.substring(0, 4000)
        }),
        timeoutPromise
      ]);

      const values =
        (response as any)?.embeddings?.[0]?.values ||
        (response as any)?.embedding?.values ||
        null;

      if (values && Array.isArray(values) && values.length > 0) {
        if (embeddingCache.size >= MAX_EMBEDDING_CACHE) {
          const oldest = embeddingCache.keys().next().value;
          if (oldest) embeddingCache.delete(oldest);
        }
        embeddingCache.set(cacheKey, values);
        return values;
      }
    } catch (err: any) {
      const msg = String(err?.message || err).toLowerCase();
      console.warn(`[EMBEDDING SERVICE] Model "${model}" failed:`, err?.message || err);
      if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('api_key_invalid')) {
        embeddingCooldownUntil = Date.now() + 60 * 1000;
        break;
      }
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  }

  return null;
}
