# ACME Salary Intelligence — Requirements

## Product and problem

**ACME Salary Intelligence** is an internal web application for an HR Manager. The organization currently manages approximately 10,000 employees across multiple countries using spreadsheets. That process makes employee records difficult to find, salary changes difficult to audit, and cross-country reporting error-prone.

The first-release goal is to provide a reliable, authenticated application for employee management, salary updates with history, and useful salary analytics without mixing currencies.

## First-release scope

- Sign in as an authorized HR user; protect all employee and salary data at the API.
- Browse, search, filter, sort, and paginate employees; view employee details and salary history.
- Create and edit employee records, and mark them inactive instead of deleting their history.
- Update an employee's salary with an effective timestamp and optional reason. Save the employee's current salary and a corresponding immutable history record atomically.
- View dashboard and analytics computed from stored records, including headcounts and salary statistics grouped by currency, department, and country.
- Provide a repeatable, explicit seed command for exactly 10,000 synthetic employees. Seeding is never part of server startup.
- Support responsive, accessible core workflows and document deployment paths for Render, Vercel, and AWS.

## Exclusions

Payroll calculations or tax filing, bank transfers, payslips, AI recommendations, complex approvals, currency conversion, multi-role administration, and microservices are excluded. They are not necessary to demonstrate the core HR workflow and would introduce policy, compliance, or operational questions that have not been answered.

## Security and privacy requirements

Salary data is sensitive. All protected API operations require server-validated authentication and authorization. Validate request and environment input, allowlist sorting and writable fields, hash passwords, constrain CORS, rate-limit sign-in, and avoid logging credentials or salary payloads. Keep secrets in server-side environment configuration, return safe errors, and use database constraints and transactions. Financial summaries are kept separate by currency; no exchange rates or conversions are implied.

## Acceptance criteria

1. An HR user can authenticate and access protected functions; an unauthenticated request is rejected by the API.
2. Employee listing is paginated on the server and supports search and validated filters/sorts.
3. Employee creation/editing validates inputs and prevents duplicate identifiers.
4. A salary update writes a matching history entry atomically, and the employee detail view displays that history with currency and effective time.
5. Dashboard and analytics values come from database queries and never combine different currencies.
6. Seeding is deterministic, repeatable, explicit, and results in exactly 10,000 synthetic employee records.
7. Automated checks exercise important domain rules, API behavior, and frontend workflows; documented commands match actual project scripts.
8. Builds and configuration are prepared for documented deployment targets without implying that any target has been deployed.

## Constraints and open questions

- This assessment has no confirmed production identity provider, HR account provisioning process, retention policy, or audit/compliance requirements. The initial release therefore uses a single HR account created through an explicit local CLI command; production provisioning and policy need owner approval.
- The initial release does not define a currency conversion source or exchange-rate date policy. Analytics must remain currency-specific.
- Salary input precision is validated per supported currency: JPY uses zero fractional digits; USD, EUR, GBP, INR, CAD, AUD, and SGD use two; BHD uses three. Confirm these currency rules with the business owner before real payroll use.
- Local PostgreSQL is used directly; database-backed checks depend on a reachable PostgreSQL instance.
- Render, Vercel, and AWS credentials/accounts are not assumed; deployment instructions are preparation, not deployment verification.
