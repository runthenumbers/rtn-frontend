# RTN Frontend

The customer-facing RTN application for managing materials, planning batches,
and understanding production costs.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

The supported Node.js version is recorded in `.nvmrc`. If you use `nvm`, run:

```bash
nvm install
nvm use
```

## Local development

Install dependencies and create your local environment file:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment configuration

Environment files live at the project root, not inside `src/`.

- `.env.example` documents the variables expected by the application and is
  safe to commit.
- `.env.local` contains developer-specific values and must never be committed.
- Variables prefixed with `NEXT_PUBLIC_` are included in the browser bundle at
  build time. They must never contain secrets.
- Server-only variables must not use the `NEXT_PUBLIC_` prefix.
- Netlify must provide production values before building the frontend.

Set `API_URL=https://rtn-backend.vercel.app` for the backend upstream.
Browser API requests use `/api/v1/...`; Next.js rewrites them to the backend
`/v1/...` endpoints. `NEXT_PUBLIC_API_URL` remains a fallback for existing
deployments. Local development defaults to `http://localhost:3001`.
Missing configuration, invalid responses, timeouts and network errors display a
retry screen. Authentication, workspace settings, materials and batches use the NestJS API.

For Vercel, import this repository, use Node.js 24, and set `NEXT_PUBLIC_APP_URL`
to the frontend production origin and `API_URL` to the backend origin.
Add the exact frontend origin to the backend production `CORS_ORIGINS` allowlist
and redeploy the backend. Proxy upstream changes require a frontend rebuild.
Set backend `FRONTEND_URL` to the exact browser-facing frontend origin. Sign-in
checks the Origin header and sets a host-only HttpOnly session cookie. Production
uses Secure `__Host-rtn-session`; development uses `rtn-session`. Verify cookie
and Origin forwarding on the hosting platform before deployment.

After deployment, verify currency options in onboarding and Settings, material
unit groups, and compatible batch units. In browser developer tools, confirm both
`/api/v1/catalogues/` requests return 200 from the production backend. Block those
requests and reload to check the error screen, then unblock and select Try again.
A throttled connection should show the loading state. This verifies catalogue
reads through the frontend, backend and production Neon.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run format:check
npm run check
npm run build
```

Use `npm run format` to apply the repository formatting rules.

Reusable form and feedback patterns are documented in
[`docs/ui-conventions.md`](docs/ui-conventions.md).

The authentication, workspace settings, materials, batches, calculation, and
error boundaries expected from the backend are documented in
[`docs/frontend-contracts.md`](docs/frontend-contracts.md).

## Route structure

Route groups organize public account screens separately from workspace screens
without changing their URLs.

```text
src/app/
├── (auth)/
│   ├── sign-in/
│   ├── sign-up/
│   ├── verify-email/
│   ├── forgot-password/
│   └── reset-password/
├── (onboarding)/
│   └── onboarding/
├── (app)/
│   ├── dashboard/
│   ├── materials/
│   │   ├── new/
│   │   └── [materialId]/edit/
│   ├── batches/
│   │   ├── new/
│   │   └── [batchId]/
│   └── settings/
├── globals.css
├── layout.tsx
└── page.tsx
```

The typed route catalogue is defined in `src/lib/routes.ts`. Authentication uses
`/api/v1/auth/register`, `sign-in`, `me`, `verify-email`, `resend-verification`
and `sign-out`. Session cookies are HttpOnly; no authentication token or mock
session is stored in browser storage. Protected app/onboarding layouts validate
sessions server-side, and client route gates resolve session state through the API.

Registration shows verification instructions instead of signing the user in.
The `/verify-email` page reads the emailed token from the URL fragment, removes
it from the address bar, and submits it only after confirmation. Password recovery
uses `/api/v1/auth/forgot-password` and `/api/v1/auth/reset-password`. The reset
page also reads the token from the fragment and removes it from history before
submission. Success clears the cookie and reloads sign-in with a confirmation.
Recovery pages remain accessible while signed in and do not require workspace
onboarding. Registration and reset accept passwords of 6–128 characters.

Workspace onboarding posts to `/api/v1/workspaces` through the same-origin proxy.
After creation, it refreshes `/auth/me` before entering the dashboard. Conflicts
and uncertain network/server failures are reconciled against `/auth/me` so a lost
creation response does not require another workspace. Backend validation errors
appear against the matching fields, and expired sessions return to sign-in.

Route gates and sign-in redirects use `/auth/me.workspaceContext`: null requires
onboarding, while a populated context enters the workspace. Workspace name and
currency throughout the UI come from this server context; no browser workspace
record is used. Reloads and new tabs resolve the persisted workspace. Settings
loads the saved profile from GET /api/v1/workspaces/:workspaceId and saves it with
PUT to the same endpoint. OWNER and ADMIN can edit; MEMBER sees disabled fields.
Saved values update session context and other tabs. Failed saves retain the draft;
base-currency conflicts explain why existing material prices prevent a change.
Materials and batches use tenant-scoped backend persistence. The dashboard consumes a workspace-scoped backend summary with counts, current cost estimates and calculation coverage.

Set backend `FRONTEND_URL` to the exact frontend origin (`http://localhost:3000`
for local development). Use `npm run dev` against a development backend; production
frontend/backend deployments must both use production cookie settings.

Run `npm run test:auth` for authentication request/error-mapping and password-policy
tests. Run `npm run test:onboarding` for workspace submission, field-error mapping,
session refresh, conflict and lost-response recovery tests. Browser checks should
cover signup, explicit email verification, sign-in, onboarding, reload, new tabs,
failed and successful sign-out, and account switching. Deploy the matching backend release before deploying this frontend.

All cost calculations and dashboard cost aggregation run on the backend. The
unchanged calculation engine provides authoritative current-price estimates;
historical price snapshots and actual production costing remain outside this MVP.
See `docs/frontend-contracts.md`.

## Deployment

The `master` branch deploys to Netlify at
[rtnweb.netlify.app](https://rtnweb.netlify.app/).

v0.3 requires the backend material-foundation migration before deployment.
Follow `rtn-backend/docs/week-3-migration-runbook.md`, deploy the backend first,
then deploy this frontend. Run `npm run test:settings` for settings API contract,
nullable-field clearing, tenant response checks and error-handling tests.

## v0.4 — Persisted materials

Material catalogue and forms use the live list/create/detail/update endpoints.
The catalogue preserves search, category and stock filters alongside loading,
empty, error and retry states. OWNER/ADMIN may edit; MEMBER can view saved material
forms without mutation controls. Supplier is optional. Prices and quantities
remain decimal strings through API requests/responses, with up to six decimal
places and whole quantities for count units. No browser material persistence or
sample material fallback remains.

The dashboard material count and batch builder also read the live catalogue.
Batches also persist and use backend engine results for current estimates. Saves update
the shared catalogue and notify other tabs. Failed requests retain form inputs;
uncertain creation requests are not automatically retried.

Run `npm run test:materials` for material API and decimal contract tests. Deploy
backend before frontend and verify persisted create/edit/reload/new-tab journeys.
No new v0.4 migration is required beyond the existing v0.3 material migration.

## Week 6 — Live batch UI

Batch catalogue, detail, builder and dashboard now read live tenant-scoped batches.
The catalogue fetches all API pages before applying search/status filters. OWNER
and ADMIN can create drafts with unique material lines and fixed costs. MEMBER
can read batches and cannot open the builder. The detail screen shows saved
quantities and fixed costs; estimated totals use current material prices, not
historical snapshots. Missing prices show unavailable estimates rather than zero.
Actual yield is explicitly unrecorded. All decimals remain strings through API I/O.

Failed saves retain inputs and display nested server errors. Unfinished forms are
stored in sessionStorage under the current user and workspace, restored on reload
or after signing back in, and cleared after confirmed save or explicit cancellation.
They are recovery copies, not saved batches. An uncertain POST is never retried
automatically; Check saved batch looks up the existing workspace reference.

```sh
npm run test:batches
npm run test:calculations
```

For the full local journey, responsive and axe accessibility suite, use the steps
in [the Week 6 release guide](docs/week-6-live-batches.md). It requires a disposable
local PostgreSQL database, backend dependencies/build, and Chromium or Chrome.
No new migration is introduced in Week 6. The Week 5 batch migration must exist
in every deployed backend database. Deployment instructions are prepared only;
staging/production deployment and a hosted authenticated smoke test are not run.

## Week 8 — Live dashboard and release verification

The dashboard loads one tenant-scoped summary endpoint, including status counts,
three recent batches and calculation coverage. A non-calculable draft does not
hide the costs of calculable batches. Material/batch edits refresh affected
estimates in this tab and other open tabs. Money formatting preserves decimal
strings even beyond the safe-integer range. Obsolete preview-user state and the
unused placeholder page have been removed; backend calculation previews and
session-scoped draft recovery remain.

Run `npm run test:unit` for all frontend contract tests. Run
`BROWSER_TEST_DATABASE_URL=<disposable-local-url> npm run test:release:browser`
for the full registration-to-dashboard journey, password reset, batch/material
flows, repricing, role/tenant checks and accessibility. It builds and serves the
production frontend and backend over local HTTPS, asserting Secure/HttpOnly
session cookies and overriding only mail delivery with a local in-memory outbox. Nothing is sent to a real mail provider. Set
`BROWSER_CHANNEL=chrome` to use installed Chrome. Build the backend and apply
existing migrations to the disposable database first.

Frontend quality CI runs on pushes/PRs. The manual Release verification workflow
requires a reviewed full backend commit SHA and the `RTN_BACKEND_READ_TOKEN`
secret with read-only access to that repository. It runs the same full browser
suite against PostgreSQL 17 and uploads screenshots/logs. Configure that secret
before dispatching; local passes do not claim remote CI or production sign-off.

Release order, hosted checks, known limitations and sign-off status are recorded
in `../rtn-backend/docs/week-8-release-candidate.md`.
