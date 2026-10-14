# Render deployment

`render.yaml` describes the standard Node API web service and static Vite site. It does not create cloud resources from this local development session.

1. Create/attach a PostgreSQL database in Render or a compatible provider. Restrict network access and use its private connection string where available.
2. Review the Blueprint resources, region, plan, and costs before applying `render.yaml`.
3. Configure API `DATABASE_URL`, a platform-generated `JWT_SECRET` (at least 32 characters), and exact `CORS_ORIGINS`. Set the frontend `VITE_API_BASE_URL` to the deployed API `/api` URL. Verify the URLs if you change service names.
4. Build commands install workspaces, generate Prisma Client, and build the API/static web app. Start command launches the normal Node server. Health check is `/api/health`.
5. Apply `npm run db:migrate` as a controlled deployment step against the target database. Never run reset commands. Create/provision the HR account through a protected operational procedure; avoid exposing credentials in logs.
6. After deployment, check `/api/health`, sign in, page/search employees, update a test record and confirm its revision, then verify analytics. Do not run the 10,000-row synthetic seed against a production database.

Render uses the same Express server and API business logic; no provider-specific code is required. A healthy API response indicates connectivity, not full application or security verification.
