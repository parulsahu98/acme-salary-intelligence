# Security and privacy

## Implemented controls

- The API protects employee, salary, profile, and analytics routes with server-side JWT verification (`apps/api/src/middleware/auth.ts`). Only explicitly provisioned users can sign in; there is no public registration route.
- Passwords are bcrypt hashes; `prisma/create-hr.ts` obtains credentials from environment variables and does not accept a default password.
- JWTs are signed with a validated server-only `JWT_SECRET`, expire in one hour, and require the configured issuer.
- Sign-in requests are rate-limited. Helmet sets standard security headers. CORS permits only configured origins, and JSON request bodies are capped at 32 KB.
- Zod validates environment values, request fields, pagination, sort allowlists, currency and salary precision. Employee update schemas are strict and omit salary/currency; salary mutation has its own explicit contract.
- SQL values are sent through Prisma's parameterized query APIs. The only raw SQL is the fixed health probe (`SELECT 1`).
- Salary update and history insertion are one serializable transaction. PostgreSQL enforces positive salary, unique employee number/email, and restrictive history foreign keys.
- API errors do not include stack traces or database details. Authentication and salary request values are not logged.
- The web client stores bearer credentials only in memory; it does not write access tokens to local/session storage or cookies.

## Configuration and operating responsibilities

- Set a unique random `JWT_SECRET` of at least 32 characters, a private `DATABASE_URL`, and exact production `CORS_ORIGINS`; never deploy the sample values.
- Terminate TLS at the platform edge, restrict database network access to the API, use least-privilege database credentials, configure backups/restore tests, and protect environment settings with the platform's secret manager.
- Provision an initial HR account through a controlled process. `HR_EMAIL` and `HR_PASSWORD` are inputs to an explicit local CLI command; do not expose them in shell history or CI logs.
- Apply reviewed Prisma migrations as a deployment step. Do not run reset or seed commands against production. Use synthetic seed data only in an explicitly selected local environment.

## Limitations and review required

- The one-hour JWT cannot be revoked early; there is no refresh-token flow, MFA, session registry, or account lockout.
- The default rate-limit store is process-local. Multi-instance production should use a shared rate-limit store or edge controls.
- Employee changes are not recorded in a general audit log; salary revision history records salary changes only.
- CORS is not authentication and is not a substitute for API authorization.
- No formal penetration test, dependency review, privacy/legal review, backup exercise, or cloud deployment has been performed as part of this implementation. A qualified security review and production threat model are required before handling real compensation data.
- The bootstrap command can change the hash for the specified account; restrict command execution and protect supplied credentials.
