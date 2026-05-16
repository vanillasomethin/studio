# AGENTS.md

## Database workflow policy (Neon + Prisma)

- Never create Neon database branches from this repo workflow.
- Never run `prisma migrate dev`.
- For database-related CI/CD and operational workflows, use only:
  - `prisma generate`
  - `prisma migrate deploy`
- If a schema change requires a migration:
  1. create/edit the migration file under `prisma/migrations/`
  2. do **not** apply it locally in agent workflow
  3. stop after writing the migration file unless explicitly instructed otherwise
- Always target the existing `DATABASE_URL`; do not introduce temporary branch URLs.

---

## AI-native infrastructure — already built (do not re-implement)

Before proposing any observability, telemetry, remediation, query, or context feature, check this list. All of the following exist and are production-ready.

### Telemetry (`src/lib/telemetry.ts`)
- `recordError(input)` — writes to `TelemetryEvent` table + streams to `TELEMETRY_STREAM_URL`
- `recordEvent(input)` — same, for non-error events
- `getOrCreateCorrelationId(headerValue)` — reads `x-correlation-id` header or generates UUID
- `hashStack(stack)` — SHA-256 of error stack for dedup

### API error wrapper (`src/lib/with-api-handler.ts`)
- `withApiHandler(route, actorType, handler)` — HOF; auto-calls `recordError()` on uncaught exceptions and returns `{ error, correlationId }` with status 500
- Apply this to new routes instead of bare `try/catch { NextResponse.json({ error }) }`

### Learning artifacts (`src/lib/learning-artifacts.ts` + `src/lib/api-envelope.ts`)
- `buildLearningArtifact(input)` + `emitLearningArtifact(artifact)` — summarises request/response, redacts secrets, persists to DB
- `respond(data, options)` from `api-envelope.ts` — wraps a response with a learning artifact ref
- Used in `GET/POST /api/stores/save` as the reference pattern

### Universal query layer (`src/lib/query-router.ts` + `/api/query`)
- `runQueryDsl(query)` — cross-domain query engine covering 4 domains:
  - `engineering` — devices, play events, uptime
  - `sales` — campaigns, payments
  - `user_behavior` — bills, claims, store activity
  - `finance_ops` — payout status, external signals
- `GET /api/query` returns the schema; `POST /api/query` runs a query

### Device health + self-correction (`/api/cron/device-health`, `/api/agent/remediate`)
- Cron runs every 5 min; marks OFFLINE, updates `uptimePctD30`, creates `RemediationTicket` on threshold breach
- On ticket creation: calls `notifyAdminWA()` + fires non-blocking POST to `/api/agent/remediate`
- `/api/agent/remediate` calls `INTERNAL_DIAGNOSTIC_AGENT_URL` (or uses built-in fallback proposals) and writes `RemediationProposal` rows

### Context engine (`src/lib/context-engine/`, `/api/cron/context-sync`, `/api/context/search`)
- Cron syncs operational records → `ContextDocument` table (watermarked incremental)
- `POST /api/context/search` — keyword search across indexed context documents

### External signals (`src/lib/data-sources/`, `/api/cron/external-signals`)
- 3 collectors: `market-sentiment`, `competitor-activity`, `infra-cost-efficiency`
- Each fetches from an env-var URL with a hardcoded fallback for dev/staging
- Results upserted into `ExternalSignal` table; surfaced via `finance_ops` domain in query layer

### Notification hub (`src/lib/notify.ts`)
- `notifyAdminWA(message)` — Twilio WhatsApp to admin (+917411324448)
- `notifyStoreWA(phone, message)` — Twilio WhatsApp to store partner
- `notifyAdminEmail(subject, html)` — Resend email to hello@wearealive.in
- All calls are non-fatal (silently no-op if env vars missing)

