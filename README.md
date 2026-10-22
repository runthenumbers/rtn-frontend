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
- Vercel must provide production values before building the frontend.

Set `API_URL=https://rtn-backend.vercel.app` for the backend upstream.
Browser API requests use `/api/v1/...`; Next.js rewrites them to the backend
`/v1/...` endpoints. `NEXT_PUBLIC_API_URL` remains a fallback for existing
deployments. Local development defaults to `http://localhost:3001`.
Missing configuration, invalid responses, timeouts and network errors display a
retry screen. Authentication uses the NestJS API. Workspace/material/batch persistence still
uses user-scoped preview adapters.

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
reads through the frontend, backend and production Neon; preview saves remain local.

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
│   └── forgot-password/
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
is unavailable until the backend implements that endpoint; it no longer simulates
sending a reset email. Registration accepts passwords of 6–128 characters.

Workspace onboarding, settings, materials and batches remain browser previews.
Their sessionStorage keys are scoped to the authenticated user, and they do not
establish authentication or tenant authorization. A user without a local preview
workspace enters onboarding. Backend workspace/membership integration remains
separate work; preview workspace completion is not durable across browsers/tabs.

Set backend `FRONTEND_URL` to the exact frontend origin (`http://localhost:3000`
for local development). Use `npm run dev` against a development backend; production
frontend/backend deployments must both use production cookie settings.

Run `npm run test:auth` for authentication request/error-mapping and password-policy
tests. Browser checks should cover signup, explicit email verification, sign-in,
reload, failed and successful sign-out, and account switching.

The preview calculation module provides deterministic client-side estimates for
the batch builder. A production integration must validate ownership and inputs,
perform authoritative financial calculations on the server, and return saved
decimal values. See `docs/frontend-contracts.md` for the replacement contracts.

## Deployment

The `master` branch deploys to Netlify at
[rtnweb.netlify.app](https://rtnweb.netlify.app/).
