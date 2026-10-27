import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { completeOnboarding, createWorkspace, WorkspaceError } from "./api.ts";
import type { SessionUser } from "../auth/api.ts";

afterEach(() => mock.restoreAll());

const input = { businessName: "  Test Business  ", baseCurrency: "GBP" };
const user: SessionUser = {
  id: "user-id",
  email: "owner@example.com",
  name: "Owner",
  workspaceContext: {
    workspace: {
      id: "workspace-id",
      businessName: "Test Business",
      businessType: null,
      country: null,
      baseCurrency: "GBP",
      secondaryCurrency: null,
    },
    membership: { id: "membership-id", role: "OWNER" },
  },
};

function respond(status: number, body: unknown = {}) {
  return mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

test("creation sends only business fields through the cookie proxy", async () => {
  const fetch = respond(201);
  await createWorkspace({
    ...input,
    country: "GB",
    businessType: "other",
    secondaryCurrency: "USD",
    userId: "forged",
  } as typeof input);
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/workspaces");
  assert.equal(options.method, "POST");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.cache, "no-store");
  assert.deepEqual(JSON.parse(options.body as string), {
    businessName: "Test Business",
    baseCurrency: "GBP",
    country: "GB",
    businessType: "other",
    secondaryCurrency: "USD",
  });
});

test("unused optional fields are omitted rather than sent as null", async () => {
  const fetch = respond(201);
  await createWorkspace(input);
  const [, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.deepEqual(JSON.parse(options.body as string), {
    businessName: "Test Business",
    baseCurrency: "GBP",
  });
});

for (const [status, code] of [
  [400, "VALIDATION"],
  [401, "UNAUTHENTICATED"],
  [403, "FORBIDDEN"],
  [409, "ALREADY_EXISTS"],
  [500, "UNEXPECTED"],
] as const) {
  test(`creation maps ${status} to ${code}`, async () => {
    respond(status, {
      error: { fieldErrors: { businessName: ["Invalid name"], unsafe: [42] } },
    });
    await assert.rejects(createWorkspace(input), (error: unknown) => {
      assert.ok(error instanceof WorkspaceError);
      assert.equal(error.code, code);
      assert.deepEqual(error.fieldErrors, { businessName: ["Invalid name"] });
      return true;
    });
  });
}

test("creation tolerates a non-JSON failure response", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("Unavailable", { status: 503 }),
  );
  await assert.rejects(
    createWorkspace(input),
    (error: unknown) =>
      error instanceof WorkspaceError && error.code === "UNEXPECTED",
  );
});

test("onboarding refreshes the session only after creation finishes", async () => {
  const events: string[] = [];
  mock.method(globalThis, "fetch", async () => {
    events.push("create");
    return new Response("{}", { status: 201 });
  });
  await completeOnboarding(input, async () => {
    events.push("refresh");
    return user;
  });
  assert.deepEqual(events, ["create", "refresh"]);
});

test("validation errors preserve field feedback without refreshing the session", async () => {
  respond(400, {
    error: { fieldErrors: { baseCurrency: ["Unsupported currency"] } },
  });
  const refresh = mock.fn(async () => user);
  await assert.rejects(completeOnboarding(input, refresh), WorkspaceError);
  assert.equal(refresh.mock.callCount(), 0);
});

for (const status of [409, 500]) {
  test(`onboarding reconciles ${status} with an existing workspace instead of resubmitting`, async () => {
    const fetch = respond(status);
    await completeOnboarding(input, async () => user);
    assert.equal(fetch.mock.callCount(), 1);
  });
  test(`onboarding does not claim success for ${status} without a persisted workspace`, async () => {
    respond(status);
    await assert.rejects(
      completeOnboarding(input, async () => ({
        ...user,
        workspaceContext: null,
      })),
      WorkspaceError,
    );
  });
}

test("onboarding recovers a lost response after the server committed creation", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Network unavailable");
  });
  await completeOnboarding(input, async () => user);
});

test("onboarding cannot succeed when the session expires", async () => {
  respond(401);
  await assert.rejects(
    completeOnboarding(input, async () => null),
    (error: unknown) =>
      error instanceof WorkspaceError && error.code === "UNAUTHENTICATED",
  );
});

test("onboarding cannot succeed when session refresh fails", async () => {
  respond(201);
  const error = new Error("Session unavailable");
  await assert.rejects(
    completeOnboarding(input, async () => {
      throw error;
    }),
    (actual: unknown) => actual === error,
  );
});

test("a successful POST still requires persisted workspace context", async () => {
  respond(201);
  await assert.rejects(
    completeOnboarding(input, async () => ({
      ...user,
      workspaceContext: null,
    })),
    WorkspaceError,
  );
});
