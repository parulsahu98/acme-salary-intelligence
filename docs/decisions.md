# Engineering decisions

## PostgreSQL and Prisma

**Decision:** Store users, employees, and revisions in PostgreSQL using the schema in `apps/api/prisma/schema.prisma`.

**Alternatives:** A document database could store employee blobs, and direct SQL could implement all persistence. Relational constraints, unique identifiers, foreign keys, and transactions directly support the salary-history invariant. Prisma provides TypeScript-aware CRUD and migrations with less repetitive SQL.

**Trade-off:** Prisma adds generated code and an abstraction; migrations and query performance still need review. We use database-level `NUMERIC`, checks, indexes, a hand-authored migration, and a serializable salary-update transaction rather than treating the ORM as a substitute for database knowledge.

## Authentication

**Decision:** Hash HR passwords with bcrypt (cost 12) and issue a one-hour JWT in the sign-in JSON response. The browser keeps it in memory and sends it as a bearer header.

**Alternative:** An HTTP-only cookie/session would survive refresh and could simplify server-side revocation, but requires session storage and CSRF policy. Bearer headers are not automatically attached cross-site; this implementation does not persist tokens in web storage.

**Trade-off:** Browser refresh signs the user out; current tokens cannot be revoked until expiry. A production identity/provider, revocation strategy, MFA, and account lifecycle remain open operational decisions.

## Currency and arithmetic

**Decision:** Persist decimal strings in PostgreSQL `NUMERIC(19,4)`, validate supported-currency precision in `apps/api/src/domain/salary.ts`, and keep financial analytics currency-specific.

**Alternative:** A universal two-decimal number or silently converted totals. The former is wrong for currencies such as JPY and BHD; the latter needs an approved exchange-rate source and timestamp.

**Trade-off:** Cross-currency ranking/total is intentionally unavailable. PostgreSQL computes average/min/max; median and quartile classification use scaled integer arithmetic. Formatting is for presentation, not payroll/payment processing.

## Application and deployment shape

**Decision:** React + Vite static frontend, Express API, PostgreSQL, and a modular monolith.

**Alternatives:** Next.js server rendering, microservices, caches, a queue, or Kubernetes. None is needed by the current HR use cases or a 10,000-row dataset using bounded pagination and indexed relational queries.

**Trade-off:** Hosting requires a separate API and database. The Vercel instructions deploy only the static client and point it at the same Node API, rather than asserting a persistent Express process runs unchanged in serverless functions.

## Synthetic-data safety

**Decision:** `apps/api/prisma/seed.ts` inserts stable IDs in batches and refuses to finish unless the database contains exactly 10,000 employees. It never deletes/reset records and is never called by server startup.

**Trade-off:** It is designed for a fresh local database or an already-seeded dataset, not for mixing synthetic and real production records. The operator must verify the target database before running it.
