# Frontend integration contracts

This document records the boundaries currently simulated by the UI. The mock
implementations are replaceable adapters, not production authentication,
authorization, persistence, or financial data.

## Authentication session

Authentication now uses the NestJS cookie-session endpoints. `/v1/auth/me`
returns:

```ts
interface SessionUser {
  id: string;
  email: string;
  name: string;
}
```

The client distinguishes loading, authenticated, unauthenticated and unavailable
states. Only a `401` session response means signed out; backend/network failures
produce retry UI. App/onboarding layouts also check the cookie against the API
on the server. Session tokens are never stored in localStorage or sessionStorage.

- registration success → verification instructions; no session is created
- verification link → explicit confirmation → sign in
- authenticated account without a local preview workspace → onboarding
- authenticated account with a local preview workspace → dashboard
- successful sign-out → server revocation, cookie deletion, sign-in screen
- failed sign-out → error and retry, without claiming the session ended

The backend does not yet return memberships or onboarding state. Workspace gates
currently use user-scoped preview workspace data independently of authentication.
All authenticated users start with empty preview collections; sign-in never seeds
another user's demo business. Business data still needs backend integration.

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

The frontend submits:

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

- `businessName` is required after trimming.
- `baseCurrency` must be in the canonical currency catalogue.
- `secondaryCurrency` is optional and must differ from `baseCurrency`.
- optional business type and country values must come from their catalogues.
- successful creation associates the business with the authenticated internal
  user, makes it active, and marks onboarding complete atomically.
- failed creation leaves onboarding incomplete and returns field or general
  errors without discarding entered values.

The backend must not trust catalogue membership or ownership claims from the
browser. It must validate them independently.

## Workspace settings

Settings reads and updates the same active `MockWorkspace` record created by
onboarding. The editable contract is identical to `BusinessDetailsInput`: the
business name is trimmed and required, business type and country are optional
catalogue values, the base currency is required, and the optional secondary
currency must be supported and different from the base currency.

The preview adapter stores the record in `sessionStorage`, publishes same-tab
updates to workspace subscribers, and therefore updates shell naming and all
currency-formatted screens immediately. Currency changes alter display
formatting only; they do not convert or recalculate recorded monetary values.
A production update must be scoped to an authorised active business, validate
catalogue values again, persist atomically, and return the canonical updated
business profile.

## Dashboard view model

The production dashboard should expose one payload shaped like:

```ts
interface DashboardViewModel {
  business: {
    id: string;
    name: string;
    baseCurrency: CurrencyCode;
  };
  materialCount: number;
  batchCount: number;
  recordedBatchCosts: string;
  recentBatches: Array<{
    id: string;
    name: string;
    status: "Draft" | "Costed";
    outputUnits: string;
    totalCost: string;
    costPerUnit: string;
  }>;
}
```

Authoritative decimal values should arrive as strings. Formatting belongs to
the presentation layer; financial arithmetic does not. The preview dashboard is
currently derived from the same mock material and batch collections as their
catalogues so new records and counts remain coherent.

An empty `recentBatches` array produces the first-time state. A populated array
produces the recent-batches table. Counts must be scoped to the active business.

## Batch catalogue and detail view models

The batches catalogue expects records scoped to the active business, with a
stable identifier, human-readable reference, status, planned or completed date,
output description, yield, total cost, and cost per unit. Search and status
filtering are currently presentation concerns and can move to query parameters
when the backend supports them.

The batch detail payload also supplies read-only formulation, packaging, and
production-cost lines plus an explicit cost summary. In production, all
monetary values must arrive as authoritative decimal strings. The detail view
formats those saved values in the active workspace currency but does not derive
line totals, category subtotals, batch totals, yields, or unit costs.

An empty catalogue produces the first-time state. An unknown identifier produces
the batch-not-found state without exposing storage or ownership details.

## Batch creation and calculation boundary

The batch builder submits identity, a planned date, target output, and one or
more unique material lines. Each line references a material identifier and
supplies a positive decimal quantity plus a unit from the same measurement
dimension as that material's purchase unit. Count quantities are whole numbers.
Material ownership, current prices, unit compatibility, reference uniqueness,
and all values must be validated again by the production API.

The mock calculation adapter accepts decimal strings and uses exact rational
arithmetic backed by integers. It never uses display-formatted currency or
ordinary binary floating-point as an authoritative input. Unit conversion uses
the central catalogue's integer base-unit factors (grams, millilitres, and
items). Its precision policy is:

- purchase prices, pack quantities, formulation quantities, and target output
  are parsed from unformatted decimal strings;
- exact values are retained throughout conversion, multiplication, summation,
  and division;
- currency subtotals and the batch total use round-half-up to 2 decimal places;
- individual line costs and cost per output unit use round-half-up to 4 decimal
  places, while currency UI may retain at least 2 trailing decimal places;
- count-based quantities (`item`) must be whole numbers; mass and volume may be
  fractional;
- the authoritative total is rounded once from the exact sum, rather than
  summing independently rounded display lines.

Mock submission persists the returned calculation strings with the batch. The
catalogue and detail views format those saved results and do not calculate a
competing total. A future production endpoint must resolve material prices and
perform this calculation server-side in an atomic create operation. Its response
should return the complete saved batch view model and authoritative decimal
strings; browser-side live feedback is advisory only.

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
