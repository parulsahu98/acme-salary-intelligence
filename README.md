# ACME Salary Intelligence

ACME Salary Intelligence is an internal HR web application for managing employee records and salary history across countries. It replaces spreadsheet workflows with a searchable employee directory, transactional salary revisions, and currency-aware analytics.

> This repository contains an implementation and deployment preparation, not a live deployment. It has not had a formal security review and should not be used with real compensation data before operational and security review.

## Features

- JWT-authenticated HR access enforced by the API.
- Paginated, searchable, filterable, sortable employee directory; create, edit, and profile views.
- Salary updates recorded with an effective time and optional reason. Current salary and revision history update atomically.
- Dashboard and analytics sourced from PostgreSQL records, with financial figures separated by currency.
- Repeatable explicit seed for 10,000 deterministic synthetic employees.
- Responsive React interface, accessible labels/keyboard controls, loading/error/empty states.

Out of scope: payroll/tax processing, payments, payslips, currency conversion, AI recommendations, complex approvals, and microservices. Product assumptions are listed in [requirements](docs/requirements.md).

## Technology

React 19, TypeScript, Vite, React Router, Tailwind CSS, Recharts; Node.js, Express, Zod, Prisma, PostgreSQL; Vitest, React Testing Library, Supertest, and Playwright.

## Architecture

```mermaid
flowchart LR
  HR[HR browser] --> Web[React + Vite]
  Web -->|bearer token / JSON| API[Express + TypeScript]
  API --> Domain[Zod and salary rules]
  API --> Service[Application services]
  Service --> Prisma[Prisma ORM]
  Prisma --> DB[(PostgreSQL)]
```

See [architecture](docs/architecture.md), [decisions](docs/decisions.md), and [patterns/SOLID](docs/patterns-and-solid.md) for schema, request flow, and trade-offs.

## Repository layout

```text
apps/
  api/       Express API, Prisma schema/migration/seed, API tests
  web/       React/Vite application and frontend tests
docs/        Requirements, architecture, security, testing, and deployment guides
e2e/         Playwright authenticated user journey
```

## Prerequisites and local setup

- Node.js 22 or later and npm (workspaces).
- PostgreSQL 15+.

1. Install dependencies: `npm ci`.
2. Start PostgreSQL locally or use a disposable PostgreSQL database.
3. Configure the API and browser separately:

   ```sh
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

   Set `DATABASE_URL` in `apps/api/.env` and replace `JWT_SECRET` with a unique random value of at least 32 characters. `apps/web/.env` sets `VITE_API_BASE_URL` to `http://localhost:4000/api`.

4. Generate the Prisma client and apply migrations:

   ```sh
   npm run db:generate
   npm run db:migrate
   ```

5. Optionally seed a fresh local database before creating any HR account. Seeding requires an explicit opt-in, an exact URL allowlist match, and a local `acme_salary` or `acme_salary_test` database:

   ```sh
   SEED_DATABASE_URL="postgresql://mac:postgres@localhost:5432/acme_salary?schema=public"
   DATABASE_URL="$SEED_DATABASE_URL" \
   SEED_ALLOWED_DATABASE_URL="$SEED_DATABASE_URL" \
   NODE_ENV=development \
   SEED_SYNTHETIC_DATA=YES \
   npm run db:seed
   ```

   The local seed refuses remote hosts, unapproved database names, missing opt-in/allowlist configuration, user accounts, partial data, and anything other than the exact deterministic synthetic dataset. It never deletes or resets records. Use the same explicit opt-in and URL allowlist for a repeat run against the verified baseline dataset.

### One-time Neon production seed

The standard development/test seed remains restricted to local PostgreSQL. A one-time production run is permitted only when all Neon approvals below are provided to the manually invoked command. It requires the exact connection URL, endpoint hostname, and database name to be approved; verifies every checked-in Prisma migration and required schema constraint; and refuses any existing employee or salary revision rows. Existing HR user rows are preserved. The insert and preflight checks run in one serializable transaction, and a successful run cannot be repeated because the employee/history tables will no longer be empty. It is never part of application startup or a deploy hook.

Before running, confirm the Neon endpoint hostname and database name in the Neon console and confirm the Render backend's `DATABASE_URL` points to that exact endpoint/database. In the Render service Shell (or another trusted shell where `DATABASE_URL` is already injected securely), first check migration status without printing the connection URL. These commands assume the shell starts at the repository root; if Render's Root Directory is `apps/api`, omit `cd apps/api` for the status check and later omit `cd ..`, running `npm run db:seed` from `apps/api` instead:

```sh
cd apps/api
npx prisma migrate status
```

Proceed only if status says the database schema is up to date. Then return to the repository root and manually invoke the existing seed script once, replacing only the hostname and database-name placeholders:

```sh
cd ..
NODE_ENV=production \
SEED_SYNTHETIC_DATA=YES \
SEED_NEON_ONCE=YES \
SEED_ALLOWED_DATABASE_URL="$DATABASE_URL" \
SEED_ALLOWED_NEON_HOST="YOUR-EXACT-ENDPOINT.neon.tech" \
SEED_ALLOWED_NEON_DATABASE="YOUR-EXACT-DATABASE-NAME" \
npm run db:seed
```

Keep `DATABASE_URL` in the Render environment (or a secret manager); do not paste it into source files, logs, or GitHub. Do not add the one-time opt-in/allowlist variables to persistent service environment settings. If migration status is not current, the hostname/database does not match, or the employee/history tables are not empty, the seed aborts without deleting or overwriting data. Do not seed a production database containing real employee data.

6. Provision a local HR account. Enter the password at a hidden prompt rather than placing it in shell history:

   ```sh
   read -r -p "HR email: " HR_EMAIL
   read -r -s -p "HR password: " HR_PASSWORD
   printf '\n'
   export HR_EMAIL HR_PASSWORD
   npm run db:create-hr
   unset HR_EMAIL HR_PASSWORD
   ```

   Seed before creating this account: the seed intentionally refuses databases containing user records.

7. Run the API and frontend: `npm run dev`. Open `http://localhost:5173`.

The access token lives in browser memory; a page refresh requires a new sign-in. Authentication accounts are created explicitly, not by a default credential.

## Commands

| Purpose                                                          | Command                                          |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| Generate Prisma client                                           | `npm run db:generate`                            |
| Apply committed migrations                                       | `npm run db:migrate`                             |
| Seed exactly 10,000 synthetic employees                          | `npm run db:seed`                                |
| Provision/update HR account from `HR_EMAIL` and `HR_PASSWORD`    | `npm run db:create-hr`                           |
| Run API + web dev servers                                        | `npm run dev`                                    |
| Unit/component tests                                             | `npm test`                                       |
| Database API integration tests (dedicated `_test` database only) | `npm run test:integration --workspace @acme/api` |
| Type-check                                                       | `npm run typecheck`                              |
| Lint                                                             | `npm run lint`                                   |
| Production builds                                                | `npm run build`                                  |
| Playwright E2E                                                   | `npm run test:e2e`                               |

Playwright requires a migrated and seeded disposable local database, an HR test account, and `E2E_HR_EMAIL` / `E2E_HR_PASSWORD` in the environment. It updates the deterministic synthetic employee `ACME-00001`, so do not point it at production.

API integration tests also require a dedicated database whose name ends with `_test`; set `DATABASE_URL` and migrate it before running the command. The integration test verifies auth, employee create/edit, pagination, duplicate conflicts, salary history, currency mismatch, transaction rollback, and analytics, and cleans up only its uniquely named test rows. Its database user needs permission to create and drop a temporary test trigger/function.

## Deployment

- [Render](docs/deployment/render.md): static React site and standard Node web service; configure PostgreSQL, JWT secret, exact CORS origin, and migration procedure.
- [Vercel](docs/deployment/vercel.md): static frontend only, calling the standard API on a supported Node host.
- [AWS](docs/deployment/aws.md): cost-aware S3/CloudFront, Node.js API, and private RDS outline.

Deployment checklist: review account/region/cost; set server-only secrets; configure the deployed frontend origin in CORS and `VITE_API_BASE_URL`; apply reviewed migrations as a separate step; configure HTTPS, database access, backups, health checks; smoke-test sign-in, directory, salary revision/history, and analytics. No target has been deployed or independently verified.

## Security

See [security controls and limitations](docs/security.md). Key points: server-side bearer authorization, bcrypt password hashes, input allowlists, login rate limiting, restricted CORS, database constraints, and transactional salary history. Production still needs managed secrets, TLS/networking, backups, account lifecycle and revocation policy, and a formal security/privacy review.

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture and schema](docs/architecture.md)
- [Engineering decisions](docs/decisions.md)
- [Security](docs/security.md)
- [Testing](docs/testing.md)
- [Patterns and SOLID](docs/patterns-and-solid.md)
- [Render](docs/deployment/render.md) · [Vercel](docs/deployment/vercel.md) · [AWS](docs/deployment/aws.md)

## Known limitations

- No live deployment, demo video, cloud credential validation, or production database has been provided.
- End-to-end tests need a local seeded database and provisioned HR credentials; the database integration test uses temporary DDL to verify transaction rollback in a dedicated `_test` database.
- JWTs are not revocable before their one-hour expiration; no MFA/SSO, shared rate-limit backend, or general employee audit log is included.
- Salary input precision is defined per supported currency, but real payroll use requires owner-approved currency and rounding policy.
