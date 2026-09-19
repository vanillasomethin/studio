# Local end-to-end slot-booking harness

Drives the **real** stack — real Postgres, real Next.js app, real admin login with
2FA, real device pairing — to check that a bulk slot booking actually reaches a
screen. It complements `scripts/verify-slot-booking.mjs`, which tests the planner's
rules as pure math; this checks the wiring around it.

Everything here writes rows. `guard.mjs` refuses to run unless `DATABASE_URL`
points at localhost, because these scripts would otherwise book ads onto real
screens.

## Setup

A disposable Postgres (any local instance will do):

```bash
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
mkdir -p /var/lib/alivepg && chown postgres:postgres /var/lib/alivepg && chmod 700 /var/lib/alivepg
su -s /bin/bash postgres -c "$PGBIN/initdb -D /var/lib/alivepg -U postgres --auth=trust"
su -s /bin/bash postgres -c "$PGBIN/pg_ctl -D /var/lib/alivepg -l /var/lib/alivepg/pg.log \
  -o '-p 5433 -c listen_addresses=127.0.0.1' start"
psql -h 127.0.0.1 -p 5433 -U postgres -c 'create database alive;'
```

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/alive?schema=public"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
export AUTH_SECRET="local-e2e-secret"
export NEXTAUTH_URL="http://localhost:9002"
export AUTH_TRUST_HOST=true

npx prisma migrate deploy
npm run e2e:seed
npm run dev &            # must be running for the steps below
npm run e2e:login
npm run e2e:book
npm run e2e:plan
```

## What each step proves

| Step | Checks |
|---|---|
| `e2e:seed` | Admin with password + TOTP, three slot-mode stores (loops 6/10/6, one closed at weekends), campaigns with a 10s and a 30s creative. Cross-checks the TOTP generator against `src/lib/totp.ts`. |
| `e2e:login` | The endpoint is 401 before sign-in and authorized after, through the real `admin-mfa` provider. |
| `e2e:book` | Nine booking scenarios against the live API — allocation, idempotency, multi-slot spans, the 409 and 400 refusals, closed days, copy-day — then reads the rows back and checks span groups are whole, consecutive and inside their loop. |
| `e2e:plan` | Books today, pairs a device as an Android TV does, and asserts the plan the screen receives: a 30s ad as one 30 000 ms item covering three positions, and an unsold position filled by a bonus replay rather than going dark. |

The slot loop arrives in the plan's **`fallback`** (a store's base programming),
not `items` — `items` carries scheduled content, which is a different path.

## Notes

- The seeded admin password and TOTP secret are test fixtures for a throwaway
  database, not credentials to anything real.
- Scripts run under Node's type-stripping loader so they can import `src/lib/*.ts`
  directly. `tsx` cannot load these modules on Node 22.22.
- `state.json` (the saved browser session) is generated and gitignored.
