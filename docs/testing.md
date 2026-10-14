# Testing and verification

## Commands

From the repository root:

```sh
npm test
npm run test:integration --workspace @acme/api
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

API tests live in `apps/api/tests`; frontend tests live alongside the client source. E2E coverage is in `e2e/hr-journey.spec.ts`.

## Coverage

- Salary unit tests cover currency-specific precision, invalid/non-positive input, odd/even median, no mutation of median inputs, and relative salary bands.
- API tests exercise unauthenticated route rejection and malformed login validation without requiring a database query.
- The separate API integration test requires a dedicated database with a name ending `_test`. It creates its own HR identity and unique employee and cleans up only those rows. It covers create/edit, unauthorized requests, paginated search, duplicates, mass assignment rejection, salary update/history persistence, currency mismatch, analytics, and rollback when a test-only database trigger rejects the history insert. The database role must be able to create and drop that trigger and function.
- Frontend tests verify that the sign-in form sends credentials to the API and currency formatting retains a currency marker.
- Playwright describes the authenticated workflow: sign in, dashboard, search deterministic seeded employee `ACME-00001`, update its JPY salary, confirm history, then open analytics. It requires a migrated/seeded local database, a provisioned HR test account, local servers, and `E2E_HR_EMAIL` / `E2E_HR_PASSWORD`. Without these variables Playwright reports an explicit skip reason.

## Database setup

Database-backed route/service workflows and the seed need PostgreSQL. Start PostgreSQL locally or use another disposable PostgreSQL database. Copy `apps/api/.env.example` to `apps/api/.env`, set its `DATABASE_URL`, and run `npm run db:migrate`. Follow the explicit seed opt-in and allowlist instructions in the root README; seed only an empty target or the exact baseline synthetic dataset, before provisioning an HR user.

The local verification database is `acme_salary_test` on `localhost:5432`. It contains synthetic test data only and is separate from production.

Use the dedicated `acme_salary_test` database for integration tests. Migrate it with `DATABASE_URL="postgresql://mac:postgres@localhost:5432/acme_salary?schema=public"
' npm run db:migrate`, then run the integration test with the same `DATABASE_URL`. The integration test refuses URLs whose database name does not end with `_test` and temporarily creates/drops a trigger/function to force an atomic rollback.

## Results and gaps

Observed in this workspace:

- `npm run lint`, `npm run typecheck`, and `npm run build`: passed for API and web.
- `npm test`: 15 tests passed (12 API unit/auth/seed-safety tests and 3 frontend tests).
- `npm run test:integration --workspace @acme/api`: 1 database integration test passed against `acme_salary_test`.
- `npm run test:e2e`: 1 authenticated browser journey passed using a locally installed Chromium browser.
- Vite emitted JavaScript chunks of 274.62 kB and 394.83 kB (uncompressed); no chunk-size warning was reported.
- Prisma schema validation passed; migration status reported two migrations and an up-to-date schema for `acme_salary_test`.
- Seed configuration tests reject missing opt-in/allowlist/database URL, production, remote hosts, and unapproved database names. The seed command also refused the already-populated test database because it contains a user account; employee, salary revision, and user counts were unchanged at 10,000, 10,003, and 1.
- `render.yaml` parsed as YAML; `vercel.json` parsed as JSON.

The integration test verifies both the successful transactional update path and rollback after an injected history-write failure. The guarded seed was not run against an empty database during this verification; only its safe refusal paths were executed. No cloud deployment, dependency audit, accessibility audit, formal security review, or performance benchmark was performed.
