import { NextRequest, NextResponse } from 'next/server';
import { QUERY_SCHEMA, runQueryDsl } from '@/lib/query-router';

export async function GET() {
  return NextResponse.json({ schema: QUERY_SCHEMA });
}

export async function POST(req: NextRequest) {
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
