# Frontend integration contracts

This document records the live authentication, workspace, material and batch contracts. Dashboard counts and cost estimates derive from persisted records.

## Authentication session

Authentication now uses the NestJS cookie-session endpoints. `/v1/auth/me`
returns:

```ts
interface SessionUser {
  id: string;
  email: string;
  name: string;
  workspaceContext: {
    workspace: {
      id: string;
      businessName: string;
      businessType: string | null;
      country: string | null;
      baseCurrency: string;
      secondaryCurrency: string | null;
    };
    membership: { id: string; role: "OWNER" | "ADMIN" | "MEMBER" };
  } | null;
}
```

The client distinguishes loading, authenticated, unauthenticated and unavailable
states. Only a `401` session response means signed out; backend/network failures
produce retry UI. App/onboarding layouts also check the cookie against the API
on the server. Session tokens are never stored in localStorage or sessionStorage.

- registration success → verification instructions; no session is created
- verification link → explicit confirmation → sign in
- authenticated account with null workspace context → onboarding
- authenticated account with populated workspace context → dashboard
- successful sign-out → server revocation, cookie deletion, sign-in screen
- failed sign-out → error and retry, without claiming the session ended

Workspace gates and workspace display data use the server's workspace context.
Missing or malformed context is an error rather than a preview fallback. The
backend selects the earliest membership by creation time and ID, excluding
archived workspaces. Workspace switching remains deferred. Material and batch data are fetched per workspace. Batch form recovery copies are scoped to both the authenticated user and workspace.

### Authentication errors

Sign-in uses the generic invalid-credentials response for incorrect passwords or
unknown emails. The verification reminder is shown only for the backend's specific
unverified-email response. Validation errors are mapped to account form fields.
A registration delivery failure offers verification resend because the account may
already exist. Resend uses the backend's generic acknowledgement.

Password recovery uses `POST /v1/auth/forgot-password` with an email and always
shows the same acknowledgement on success. `POST /v1/auth/reset-password` accepts
the token and an unchanged password; confirmation is validated locally and is not
persisted. The email link targets `/reset-password#token=...`; the page removes
the fragment, keeps the token in memory, validates matching 6–128-character
passwords and submits only on confirmation. Invalid/expired/used links offer a new
request, while transient failures preserve the form for retry. Success reloads
`/sign-in?reset=success`, discarding previous account context. Recovery pages are
accessible even while signed in and do not depend on workspace onboarding.

## Business onboarding

The frontend submits to `POST /api/v1/workspaces` using the same-origin proxy:

```ts
interface BusinessDetailsInput {
  businessName: string;
  businessType?: BusinessType;
  country?: CountryCode;
  baseCurrency: CurrencyCode;
  secondaryCurrency?: CurrencyCode;
}
```

Rules:

- `businessName` must contain 2–160 characters after trimming.
- `baseCurrency` must be in the canonical currency catalogue.
- `secondaryCurrency` is optional and must differ from `baseCurrency`.
- optional business type and country values must come from their catalogues.
- successful creation associates the business with the authenticated internal
  user, makes it active, and marks onboarding complete atomically.
- validation failures return field errors without discarding entered values.

Creation returns `201` with workspace and OWNER membership context. The client
refreshes `/auth/me` and requires persisted context before entering the dashboard.
A `409`, lost response or server failure triggers a session refresh to discover
whether creation already committed. If no workspace exists, the form remains
available for retry; expired sessions return to sign-in. No workspace record is
saved in browser storage.

The backend must not trust catalogue membership or ownership claims from the
browser. It must validate them independently.

## Workspace settings

Settings loads `GET /api/v1/workspaces/:workspaceId` and saves the complete editable
profile with `PUT` to that endpoint. Both use the cookie proxy and disable caching.
The read/update response is the same WorkspaceContext shape as /auth/me. Required
businessName/baseCurrency and nullable businessType/country/secondaryCurrency are
sent explicitly; blank optional selections become null. OWNER and ADMIN may
update; MEMBER fields are disabled and the backend enforces permissions.

Successful saves use the canonical response to update local form state and the
auth provider, refreshing workspace naming and currency displays. Other tabs
revalidate through BroadcastChannel. Reloads fetch persisted settings. Field
errors map to inputs; failed saves retain drafts and offer retry. 401/404 trigger
session revalidation, 403 reports insufficient access, and 409 explains the
base-currency lock after materials exist. No automatic currency conversion occurs.
Concurrent editors currently use last-write-wins semantics.

The material schema and decimal-string contracts are now defined in
`rtn-backend/docs/material-api-contract.md`. v0.4 implements material CRUD and removes the material preview adapter.

## Dashboard and batch reads

`GET /v1/workspaces/:workspaceId/batches` returns `{ items: Batch[] }` with at
most 100 records per request. The frontend fetches all pages (limit=100 and an
offset) before applying catalogue search/status filters, so older saved batches
are included. The dashboard uses this same collection for counts and recent
batches. `GET /v1/workspaces/:workspaceId/batches/:batchId` loads detail independently
of catalogue pagination. A 404 produces Batch not found; network/server errors
produce retry UI. There is no sample-data fallback.

Records include id, workspaceId, name, reference, notes, nullable plannedDate,
targetOutputQuantity, outputUnitCode, currencyCode, createdAt, updatedAt, lines
and fixedCosts. Status codes DRAFT, PLANNED, IN_PRODUCTION and COMPLETED map to
Draft, Planned, In production and Completed. Nested lines include materialId,
quantity and unitCode; fixed costs include name and amount. All decimals use
strings and up to six decimal places. The adapter validates response ownership,
child batch IDs, dates, supported units and decimal shapes before displaying data.

## Batch creation and estimates

`POST /v1/workspaces/:workspaceId/batches` creates a DRAFT. Requests contain name,
reference, notes, nullable plannedDate, targetOutputQuantity, outputUnitCode,
lines (`materialId`, `quantity`, `unitCode`) and fixedCosts (`name`, `amount`).
The frontend whitelists these fields and never submits client-computed costs,
status, user, currency or workspace ownership. The backend supplies ownership
and currency, rechecks permissions in the write transaction, validates materials
and compatible units, and atomically persists both child collections.

The builder requires at least one material and a planned date. Decimal fields
support up to 14 integer digits and 6 fractional digits; quantities are positive,
COUNT quantities are whole, and fixed costs can be zero. Name/reference limits
are 160/80 characters, notes 5000, line count 500 and fixed-cost count 100.
OWNER/ADMIN can save and MEMBER can read. All writes require trusted Origin and
cookie authentication. Reference uniqueness is case sensitive per workspace.

Current cost estimates use exact integer fractions for compatible unit conversion,
material costs, fixed-cost summation and division. Totals are rounded half-up to
2 decimal places once after summation; individual material line costs and unit
costs use 4 places. Fixed-cost inputs persist with six-place precision. These
estimates are advisory: the API stores quantities and fixed costs, without
material-price snapshots, authoritative totals, actual output or yield. Reopening
a batch uses current material prices. Missing/incompatible material prices leave
estimates unavailable while retaining saved quantities and fixed costs on screen.

Validation errors map to batch fields and indexed line/fixed-cost inputs. A 401
refreshes the session and returns to sign-in; an unfinished recovery copy in
sessionStorage is keyed by user and workspace and restored when the same user
returns to the builder. No session token is stored there. Failed requests retain
the form; successful saves and explicit Cancel remove the recovery copy. A failed
or timed-out POST is not automatically retried. Check saved batch queries existing
batches by the same reference so a lost response can be recovered without creating
a duplicate. A reference conflict also allows reviewing the existing saved batch.

## Error response

API errors should use one predictable structure:

```ts
interface ApiError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
}
```

Unexpected errors must not expose stack traces, provider details, credentials,
or database information. The frontend should map known field errors to their
controls and show a safe general message for everything else.

## v0.4 material integration

MaterialsProvider scopes the live list to the authenticated user and workspace.
Account/workspace changes remount the provider, abort old requests and clear the
old list. Forms GET a requested detail directly, POST new materials and PUT full
replacements. Responses are validated against the requested workspace/material.
The client maps category enums to UI labels, nullable supplier to a blank field,
and unitCode to its supported unit catalogue. Stock status compares exact decimal
strings using scaled integers; forms never convert saved inputs to numbers.
The batch builder consumes the same exact material input strings.

No sessionStorage material records are read or written. Load failures show retry
states instead of sample records. A successful write updates the shared list,
revalidates it and sends a workspace-scoped BroadcastChannel notification to other
tabs. Owner/admin permissions are enforced both in UI and backend; MEMBER fields
are disabled. Server field errors map to inputs and drafts survive failed saves.
