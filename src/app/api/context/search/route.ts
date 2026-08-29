import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cosineSimilarity, embedText } from '@/lib/context-engine/indexer';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

export async function POST(req: NextRequest) {
  // Context documents can contain internal operational data — admin only.
  // Fail CLOSED: the previous guard only rejected when ADMIN_PASSWORD was set,
  // so a missing env var exposed those documents to the anonymous internet.
  if (!(await requireAdmin(req))) return adminUnauthorized();
  const body = await req.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  const limit = typeof body?.limit === 'number' ? Math.min(Math.max(body.limit, 1), 25) : 10;

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  const queryEmbedding = embedText(query);
  const docs = await db.contextDocument.findMany({
    take: 200,
    orderBy: { timestamp: 'desc' },
  });

  const results = docs
    .map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({ ok: true, results });
}
