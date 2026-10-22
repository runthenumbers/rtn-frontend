import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  AuthError,
  getSession,
  signIn,
  signOut,
  signUp,
  verifyEmail,
} from "./api.ts";
import { passwordMeetsRequirements } from "./validation.ts";

afterEach(() => mock.restoreAll());

function respond(body: unknown, status = 200) {
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

test("sign-in sends normalized email and an unchanged password through the cookie proxy", async () => {
  const fetch = respond({ message: "Signed in" });
  await signIn({ email: "  USER@EXAMPLE.COM  ", password: "  secret  " });
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/auth/sign-in");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.cache, "no-store");
  assert.deepEqual(JSON.parse(options.body as string), {
    email: "user@example.com",
    password: "  secret  ",
  });
});

test("only a 401 session response means signed out", async () => {
  respond({}, 401);
  assert.equal(await getSession(), null);
  mock.restoreAll();
  respond({}, 503);
  await assert.rejects(getSession(), AuthError);
});

test("session responses retain only public user fields", async () => {
  respond({
    id: "user-id",
    name: "Example",
    email: "user@example.com",
    passwordHash: "never retain",
  });
  assert.deepEqual(await getSession(), {
    id: "user-id",
    name: "Example",
    email: "user@example.com",
  });
});

test("malformed session responses fail instead of authenticating", async () => {
  respond({ name: "Example" });
  await assert.rejects(getSession(), AuthError);
});

test("sign-out failures propagate instead of claiming success", async () => {
  respond({}, 500);
  await assert.rejects(signOut(), AuthError);
});

test("registration maps backend field errors", async () => {
  respond(
    { error: { fieldErrors: { email: ["Invalid email"], unsafe: [42] } } },
    400,
  );
  await assert.rejects(
    signUp({ name: "Example", email: "bad", password: "secret" }),
    (error: unknown) => {
      assert.ok(error instanceof AuthError);
      assert.equal(error.code, "VALIDATION");
      assert.deepEqual(error.fieldErrors, { email: ["Invalid email"] });
      return true;
    },
  );
});

test("registration distinguishes delivery failure after account creation", async () => {
  respond({}, 503);
  await assert.rejects(
    signUp({ name: "Example", email: "user@example.com", password: "secret" }),
    (error: unknown) =>
      error instanceof AuthError && error.code === "DELIVERY_FAILED",
  );
});

test("untrusted-origin errors are not reported as unverified email", async () => {
  respond({ error: { message: "Untrusted request origin." } }, 403);
  await assert.rejects(
    signIn({ email: "user@example.com", password: "secret" }),
    (error: unknown) =>
      error instanceof AuthError && error.code === "UNEXPECTED",
  );
});

test("verification submits the token only to the verification endpoint", async () => {
  const fetch = respond({ message: "Verified" });
  await verifyEmail("A".repeat(43));
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/auth/verify-email");
  assert.deepEqual(JSON.parse(options.body as string), {
    token: "A".repeat(43),
  });
});

test("password validation matches the six-to-128-character backend policy", () => {
  assert.equal(passwordMeetsRequirements("abcde"), false);
  assert.equal(passwordMeetsRequirements("abcdef"), true);
  assert.equal(passwordMeetsRequirements("a".repeat(128)), true);
  assert.equal(passwordMeetsRequirements("a".repeat(129)), false);
});
