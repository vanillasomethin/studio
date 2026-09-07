import { NextRequest, NextResponse } from 'next/server';
import { QUERY_SCHEMA, runQueryDsl } from '@/lib/query-router';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

// Exposes campaign/bill/store aggregates — admin only.

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  return NextResponse.json({ schema: QUERY_SCHEMA });
}

// POST is a read despite the verb: runQueryDsl only ever issues findMany, so
// this is analytics traffic and is deliberately not written to the audit trail.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const query = await req.json();
    const result = await runQueryDsl(query);
    return NextResponse.json({ schema: QUERY_SCHEMA, result });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message, schema: QUERY_SCHEMA },
      { status: 400 },
    );
  }
}
