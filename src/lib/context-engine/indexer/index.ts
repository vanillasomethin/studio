import { db } from '@/lib/db';
import type { CanonicalContextDocument } from '@/lib/context-engine/types';

const EMBEDDING_SIZE = 32;

export function chunkText(text: string, chunkSize = 500): string[] {
  if (!text.trim()) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export function embedText(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_SIZE).fill(0);
  for (let i = 0; i < text.length; i++) {
    vector[i % EMBEDDING_SIZE] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export async function upsertContextDocuments(documents: CanonicalContextDocument[]) {
  for (const document of documents) {
    await db.contextDocument.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: document.sourceType,
          sourceId: document.sourceId,
        },
      },
      update: {
        timestamp: new Date(document.timestamp),
        actors: document.actors,
        serviceArea: document.serviceArea,
        summary: document.summary,
        rawRef: document.rawRef,
        embedding: document.embedding,
      },
      create: {
        sourceType: document.sourceType,
        sourceId: document.sourceId,
        timestamp: new Date(document.timestamp),
        actors: document.actors,
        serviceArea: document.serviceArea,
        summary: document.summary,
        rawRef: document.rawRef,
        embedding: document.embedding,
      },
    });
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / ((Math.sqrt(normA) * Math.sqrt(normB)) || 1);
}
