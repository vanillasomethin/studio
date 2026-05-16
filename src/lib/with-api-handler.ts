import { NextRequest, NextResponse } from 'next/server';
import { recordError, hashStack, getOrCreateCorrelationId, ActorType } from '@/lib/telemetry';

type HandlerContext = { correlationId: string };
type Handler = (req: NextRequest, ctx: HandlerContext) => Promise<NextResponse>;

export function withApiHandler(route: string, actorType: ActorType, handler: Handler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const correlationId = getOrCreateCorrelationId(req.headers.get('x-correlation-id'));
    try {
      return await handler(req, { correlationId });
    } catch (e) {
      const error = e as Error;
      void recordError({
        route,
        errorClass: error.name,
        message: error.message,
        stackHash: hashStack(error.stack),
        correlationId,
        actorType,
      });
      return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
    }
  };
}
