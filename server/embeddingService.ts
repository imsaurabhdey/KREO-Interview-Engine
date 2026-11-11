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

/**
 * Generates a vector embedding for input text using Google's gemini-embedding-001 model.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!text || text.trim().length === 0) return null;
  const ai = getGeminiClient();
  if (!ai) return null;

  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text.trim().substring(0, 4000) // Truncate to safe token length
    });

    if (response) {
      if ((response as any).embeddings?.[0]?.values) {
        return (response as any).embeddings[0].values;
      }
      if ((response as any).embedding?.values) {
        return (response as any).embedding.values;
      }
    }
  } catch (err: any) {
    console.warn('[EMBEDDING SERVICE] Error generating vector embedding:', err?.message || err);
  }

  return null;
}
