# Patterns and SOLID in the implementation

References are workspace-relative so they can be opened directly in the repository.

## Layered separation and single responsibility

- **Where:** `apps/api/src/app.ts` (HTTP boundary), `apps/api/src/domain/employee.ts` and `salary.ts` (input/domain rules), `apps/api/src/services/employee.ts`, `auth.ts`, and `analytics.ts` (use cases), and `apps/api/src/db.ts` (Prisma client).
- **What/why:** Route handlers translate HTTP inputs and outputs while salary precision and multi-step persistence are kept in named domain/service modules. This keeps validation, persistence policy, and presentation from becoming one route handler.
- **Alternative/trade-off:** A repository interface and service for every endpoint could add isolation, but a wrapper that only forwards Prisma methods would duplicate abstractions. The direct service-to-Prisma boundary is simpler for this single persistence implementation and is less independently swappable.

## Transaction as a consistency boundary

- **Where:** `apps/api/src/services/employee.ts:updateSalary` and `createEmployee`.
- **What/why:** Salary update and immutable salary-history insertion share a serializable Prisma transaction; initial salary creation also records its first revision atomically.
- **Alternative/trade-off:** Separate writes are simpler but can leave the current salary inconsistent with its history on partial failure. Serializable isolation protects the read/update sequence, with increased contention/retry considerations under concurrent updates.

## Explicit allowlists and schema validation

- **Where:** `apps/api/src/app.ts` employee list query schema and `apps/api/src/domain/employee.ts:updateEmployeeSchema`.
- **What/why:** Sorting and writable fields are selected from explicit schemas to avoid injection through order fields and mass assignment.
- **Alternative/trade-off:** Generic object spreading would be shorter but would allow callers to write fields that should only change through the salary operation. Strict schemas mean API additions must be intentionally exposed.

## Strategy, Adapter, and dependency injection

- No strategy pattern is needed: there are no interchangeable pricing, conversion, or authorization policies in the first release.
- No Vercel Express adapter is shipped. The static Vercel frontend calls the same standard Node API, avoiding a second API runtime implementation.
- No dependency-injection framework or repository interface is present. Tests cover pure domain helpers and route guards; database integration deserves a disposable test database before adding deeper test seams.

## SOLID assessment

- **Single Responsibility:** domain salary helpers, HTTP app, server lifecycle, and persistence/use-case operations are separated at coarse, useful boundaries. Some view composition is concentrated in `apps/web/src/pages.tsx`; further splitting is warranted as the UI grows.
- **Open/Closed:** currency support is intentionally represented by an explicit precision map and Zod enum, so introducing a currency requires updating both supported-currency contracts and validating its policy. This is safer than pretending arbitrary currencies work, but it is not a plugin architecture.
- **Liskov Substitution / Interface Segregation / Dependency Inversion:** no inheritance hierarchy or client-owned abstraction is justified by the single implementation. Inventing substitutable interfaces without multiple implementations would add ceremony without improving the current design.
