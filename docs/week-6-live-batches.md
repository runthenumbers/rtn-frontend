# Week 6 — Live batch UI release guide

Week 7 supersedes calculation behaviour: see `../../rtn-backend/docs/week-7-calculation-integration.md`. Backend integration must deploy first.

Deployment preparation only, as requested. No staging or production deployment
has been performed, and no hosted authenticated smoke test is claimed.

## Local verification

Run frontend lint, TypeScript, formatting, API/decimal tests and build:

```sh
npm run check
npm run test:auth
npm run test:onboarding
npm run test:settings
npm run test:materials
npm run test:batches
npm run test:calculations
npm run build -- --webpack
```

Webpack is an alternative production build when the local environment blocks
Turbopack's CSS worker from opening a port. The default build remains unchanged.

For the automated browser suite, install backend dependencies and build it first.
Use an empty disposable **local** PostgreSQL database. The suite rejects remote
hosts, creates its own users/workspaces, launches local applications on ports
3100/3101, and removes its fixtures/processes on completion. It never uses the
project's remote test, staging or production database.

Example setup from `rtn-backend` (choose an unused local port/container name):

```sh
docker run --rm -d --name rtn-week6-check \
  -e POSTGRES_USER=rtn -e POSTGRES_PASSWORD=rtn_local_check \
  -e POSTGRES_DB=rtn_test -p 127.0.0.1:55491:5432 postgres:17

DATABASE_URL=postgresql://rtn:rtn_local_check@127.0.0.1:55491/rtn_test \
DIRECT_URL=postgresql://rtn:rtn_local_check@127.0.0.1:55491/rtn_test \
npm run db:migrate:deploy

npm run build
```

Then from `rtn-frontend`:

```sh
npx playwright install chromium
BROWSER_TEST_DATABASE_URL=postgresql://rtn:rtn_local_check@127.0.0.1:55491/rtn_test \
npm run test:batches:browser
```

If Chrome is already installed, use `BROWSER_CHANNEL=chrome` instead of installing
Chromium. Screenshots and application logs are saved under a printed temporary
directory. The suite covers material creation → batch formulation + fixed cost →
save → detail → reload/new-tab reopen; search/status filters; list/detail errors
and retry; unknown batches; server field errors; draft reload and real session
expiry; lost-response reconciliation; member restrictions and tenant isolation.
Responsive assertions use 320, 390, 768 and 1280px widths. Axe checks cover builder,
detail and catalogue, including mobile, against WCAG 2/2.1 A and AA rules.

After finishing, stop the disposable database:

```sh
docker stop rtn-week6-check
```

## Deployment order

1. Verify backend commit `73dc30b` or a successor containing the batch persistence
   work is available for release. Week 6 adds no backend schema change.
2. Apply/verify the existing migration `20261028180000_add_batch_persistence` in
   each target environment, using that environment's direct database URL. Both
   DATABASE_URL and DIRECT_URL must address the same environment.
3. Deploy the backend to its existing Vercel project. Verify health and batch API
   availability before deploying the frontend.
4. Deploy the frontend to its existing Netlify project, with the reviewed Week 6
   changes committed/pushed to the configured deployment branch when ready.
5. Run the hosted checks below. Local browser results do not verify hosted cookie,
   Origin forwarding, network or database configuration.

For staging (if `.env.staging` is the configured backend environment file):

```sh
npx dotenv -e .env.staging --override -- npm run db:migrate:status
# Confirm the displayed database endpoint before applying.
npx dotenv -e .env.staging --override -- npm run db:migrate:deploy
npx dotenv -e .env.staging --override -- npm run db:migrate:status
```

For production, use `.env.production` in the same commands. Use migrate deploy;
do not use reset, db push or migrate dev on shared databases. Deployment does not
apply migrations automatically. Back up shared databases before migration.

Frontend API_URL must point to the intended backend. Backend FRONTEND_URL and
CORS_ORIGINS must contain the exact browser-facing origin. Production deployments
use NODE_ENV=production and Secure host-only __Host-rtn-session cookies. Inspect
the existing Netlify build command and deploy log, and confirm the intended commit.

## Hosted smoke test

Use a designated test workspace/account on the target environment:

1. Sign in, open Materials, and create an ingredient with a known purchase basis
   (for example GBP 38.50 per 5 L). Verify it after reload.
2. Open Create batch, enter a unique reference, output 12 items, consume 750 ml,
   and add a fixed labour cost of 1.234567. Save the draft once.
3. Confirm the detail URL uses the persisted UUID; verify quantities, fixed cost,
   Draft status and notes. Reload and open that URL in another tab. Check that
   the catalogue and dashboard include the batch.
4. With those inputs, the Week 7 booked material estimate is 5.78, total estimate
   7.01 and unit estimate 0.584167 (displayed as 0.5842). These are current estimates, not final snapshots.
5. Check search, status filtering, Clear filters, mobile layouts and keyboard
   focus. In developer tools confirm same-origin /api/v1 requests succeed and
   no client-side exception occurs.
6. Verify MEMBER can read but cannot create, and another workspace cannot read
   the saved batch. Check an unknown UUID returns Batch not found.
7. On a non-production environment, test a failed request and session expiry;
   sign back in and return to Create batch to recover unfinished inputs.

Confirm backend and frontend release commits, migration status and hosted results
before marking deployment complete. A backend rollback must retain the additive
Week 5 tables; do not reverse/delete the applied migration.
