# AWS deployment

This is a manual, cost-aware deployment outline. No AWS resources were created and no pricing or account eligibility has been verified. Confirm current regional pricing, quotas, service availability, and security requirements before proceeding.

## Suggested layout

- Run the API as a Node.js service on an EC2 instance, managed by systemd and placed behind an HTTPS load balancer.
- Use Amazon RDS for PostgreSQL in private subnets; allow inbound database traffic only from the API security group.
- Build `apps/web` with `npm run build --workspace @acme/web`, upload `apps/web/dist` to a private S3 bucket, and serve it through CloudFront with HTTPS and an SPA fallback.
- Set `VITE_API_BASE_URL` at frontend build time. Configure API `CORS_ORIGINS` with the exact CloudFront origin.

## Operational checklist

1. Review cost estimates and region/account eligibility; choose smallest appropriate database/service sizes and budgets/alerts.
2. Create private RDS networking, TLS and backups; create an application database role with only required privileges. Do not expose RDS publicly.
3. Store `DATABASE_URL` and a unique `JWT_SECRET` in AWS Secrets Manager or an equivalent managed secret store. Grant the EC2 instance role access only to those secrets and required logs.
4. Install a supported Node.js runtime on the EC2 instance, deploy the built API, and configure systemd to run `npm run start --workspace @acme/api`. Place the service behind HTTPS and use `/api/health` as a health check.
5. Run reviewed Prisma migrations as a controlled deployment job, not on every server start. From the deployed application release, run `npm run db:migrate` once against the private database. Keep production seed disabled.
6. Deploy S3/CloudFront assets, verify CORS/API URL and run smoke tests for sign-in, directory, salary revision, and analytics. Plan rollback around backwards-compatible migrations and retained backups.

No live AWS deployment has been verified.
