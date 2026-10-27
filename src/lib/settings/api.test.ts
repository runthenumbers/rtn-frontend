import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  getBusinessSettings,
  updateBusinessSettings,
  SettingsError,
} from "./api.ts";

afterEach(() => mock.restoreAll());
const workspace = {
  id: "workspace-id",
  businessName: "Saved Business",
  businessType: "other",
  country: "GB",
  baseCurrency: "GBP",
  secondaryCurrency: null,
};
const context = {
  workspace,
  membership: { id: "membership-id", role: "OWNER" },
};
const input = {
  businessName: "  Saved Business  ",
  businessType: null,
  country: null,
  baseCurrency: "GBP",
  secondaryCurrency: null,
};
function respond(status: number, body: unknown = context) {
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

test("reads the requested workspace through the cookie proxy without caching", async () => {
  const fetch = respond(200);
  assert.deepEqual(await getBusinessSettings(workspace.id), context);
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/workspaces/workspace-id");
  assert.equal(options.method, "GET");
  assert.equal(options.cache, "no-store");
  assert.equal(options.credentials, "same-origin");
});

test("PUT sends a complete profile, explicit null clears and no identity fields", async () => {
  const fetch = respond(200);
  await updateBusinessSettings(workspace.id, {
    ...input,
    role: "OWNER",
    userId: "forged",
  } as typeof input);
  const [, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(options.method, "PUT");
  assert.deepEqual(JSON.parse(options.body as string), {
    ...input,
    businessName: "Saved Business",
  });
});

test("encodes workspace IDs as a single path segment", async () => {
  const fetch = respond(404, {});
  await assert.rejects(getBusinessSettings("../other"), SettingsError);
  assert.equal(
    fetch.mock.calls[0].arguments[0],
    "/api/v1/workspaces/..%2Fother",
  );
});

for (const status of [400, 401, 403, 404, 409, 500]) {
  test(`retains status ${status} and safe field feedback`, async () => {
    respond(status, {
      error: { fieldErrors: { businessName: ["Invalid name"], unsafe: [42] } },
    });
    await assert.rejects(
      updateBusinessSettings(workspace.id, input),
      (error: unknown) => {
        assert.ok(error instanceof SettingsError);
        assert.equal(error.status, status);
        assert.deepEqual(error.fieldErrors, { businessName: ["Invalid name"] });
        return true;
      },
    );
  });
}

for (const payload of [
  null,
  {},
  { ...context, workspace: { ...workspace, id: "other-tenant" } },
  { ...context, membership: { id: "id", role: "UNKNOWN" } },
]) {
  test(`rejects malformed or mismatched workspace response ${JSON.stringify(payload)}`, async () => {
    respond(200, payload);
    await assert.rejects(
      getBusinessSettings(workspace.id),
      (error: unknown) =>
        error instanceof SettingsError && error.status === 502,
    );
  });
}

test("network errors propagate instead of claiming a saved profile", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Network unavailable");
  });
  await assert.rejects(updateBusinessSettings(workspace.id, input), TypeError);
});
