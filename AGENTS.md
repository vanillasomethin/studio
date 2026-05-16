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
