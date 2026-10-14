# Vercel deployment

`vercel.json` builds and serves the React/Vite static client with an SPA fallback. The API remains the standard Node service hosted on Render or another supported persistent Node platform; this repository does not assert that the long-running Express server runs unchanged as a Vercel Function.

1. Import the monorepo, use the repository root as the Vercel project root, and configure `VITE_API_BASE_URL` to the deployed API base ending in `/api`.
2. Use the checked-in install/build/output configuration or set the project build command to `npm run build --workspace @acme/web` and output directory to `apps/web/dist`.
3. Add the exact Vercel frontend origin to API `CORS_ORIGINS`. Keep database URL and JWT secret only on the API host; do not prefix backend secrets with `VITE_`.
4. Build with `npm run build --workspace @acme/web`, then verify the deployed SPA fallback, API health, sign-in, and employee workflows.

Vercel Functions have different lifecycle, request, and database-connection constraints. A future API function adapter would need to be thin and reuse the same app/authorization/services, plus a connection-pooling plan; it is intentionally not included or tested here.
