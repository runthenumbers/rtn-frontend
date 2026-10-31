/* Runs only against a disposable local PostgreSQL database; never production. */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { default as axeModule } from "@axe-core/playwright";
const AxeBuilder = axeModule.default ?? axeModule;
const frontend = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backend = path.resolve(frontend, "../rtn-backend");
const backendRequire = createRequire(path.join(backend, "package.json"));
const { Client } = backendRequire("pg");
const argon2 = backendRequire("argon2");
const databaseUrl = process.env.BROWSER_TEST_DATABASE_URL;
const fullRelease = process.env.BROWSER_RELEASE_CHECK === "1";
const outboxToken = randomUUID();
let ownerPassword = "browser-test-password";
const registeredEmail = `release-${randomUUID()}@week8.example`;
if (
  !databaseUrl ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    "Set BROWSER_TEST_DATABASE_URL to a disposable local PostgreSQL database with the backend migrations applied.",
  );
}
const db = new Client({ connectionString: databaseUrl });
const base = fullRelease ? "https://localhost:3443" : "http://localhost:3100";
const backendOrigin = "http://127.0.0.1:3101";
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "rtn-week6-"));
const userIds = [],
  workspaceIds = [randomUUID(), randomUUID()],
  emails = [];
const processes = [];
let browser;
let tlsDirectory;
let connected = false;
function start(cwd, args, env, logName) {
  const log = fs.openSync(path.join(artifacts, logName), "w");
  const processHandle = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", log, log],
  });
  processes.push(processHandle);
  return processHandle;
}
async function ready(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Server still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server not ready: ${url}. See ${artifacts}`);
}
async function login(page, index = 0) {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email address").fill(emails[index]);
  await page
    .locator('input[name="password"]')
    .fill(index === 0 ? ownerPassword : "browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
}
async function audit(page, name) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
    [],
    `${name} accessibility`,
  );
}
async function fillBatch(page, materialId, name, reference) {
  await page.getByLabel("Batch name", { exact: false }).fill(name);
  await page.getByLabel("Batch reference", { exact: false }).fill(reference);
  await page.getByLabel("Planned date", { exact: false }).fill("2026-11-01");
  await page.getByLabel("Target output", { exact: false }).fill("12");
  await page.locator('select[name="outputUnit"]').selectOption("item");
  await page.locator('select[name="line-1-material"]').selectOption(materialId);
  await page.getByLabel("Required quantity", { exact: false }).fill("750");
  await page.locator('select[name="line-1-unit"]').selectOption("ml");
}
(async () => {
  await db.connect();
  connected = true;
  const hash = await argon2.hash("browser-test-password", {
    type: argon2.argon2id,
  });
  for (const role of ["OWNER", "MEMBER", "OUTSIDER"]) {
    const id = randomUUID();
    userIds.push(id);
    emails.push(`${role.toLowerCase()}-${id}@week6.example`);
    await db.query(
      'INSERT INTO "User" ("id","email","name","passwordHash","emailVerifiedAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())',
      [id, emails.at(-1), role, hash],
    );
  }
  for (const id of workspaceIds)
    await db.query(
      'INSERT INTO "Workspace" ("id","businessName","baseCurrency","updatedAt") VALUES ($1,$2,$3,now())',
      [id, "Week 6 browser test", "GBP"],
    );
  for (let i = 0; i < 3; i++)
    await db.query(
      'INSERT INTO "Membership" ("id","userId","workspaceId","role","updatedAt") VALUES ($1,$2,$3,$4,now())',
      [
        randomUUID(),
        userIds[i],
        workspaceIds[i === 2 ? 1 : 0],
        i === 1 ? "MEMBER" : "OWNER",
      ],
    );
  start(
    backend,
    fullRelease
      ? [path.join(frontend, "scripts/browser-backend.mjs")]
      : ["dist/main.js"],
    {
      NODE_ENV: fullRelease ? "production" : "development",
      BROWSER_RELEASE_CHECK: fullRelease ? "1" : "0",
      BROWSER_OUTBOX_TOKEN: outboxToken,
      PORT: "3101",
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      FRONTEND_URL: base,
      CORS_ORIGINS: base,
      RESEND_API_KEY: "re_local_test_dummy",
      MAIL_FROM: "test@example.com",
    },
    "backend.log",
  );
  await ready(`${backendOrigin}/health/ready`);
  if (fullRelease) {
    const build = start(
      frontend,
      ["node_modules/next/dist/bin/next", "build", "--webpack"],
      { API_URL: backendOrigin, NEXT_TELEMETRY_DISABLED: "1" },
      "frontend-build.log",
    );
    await new Promise((resolve, reject) => {
      build.once("error", reject);
      build.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                `Production frontend build failed. See ${artifacts}/frontend-build.log`,
              ),
            ),
      );
    });
  }
  start(
    frontend,
    [
      "node_modules/next/dist/bin/next",
      fullRelease ? "start" : "dev",
      "--port",
      "3100",
    ],
    { API_URL: backendOrigin, NEXT_TELEMETRY_DISABLED: "1" },
    "frontend.log",
  );
  await ready("http://localhost:3100/sign-in");
  if (fullRelease) {
    tlsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "rtn-browser-tls-"));
    const keyFile = path.join(tlsDirectory, "key.pem"),
      certFile = path.join(tlsDirectory, "cert.pem"),
      configFile = path.join(tlsDirectory, "openssl.cnf");
    fs.writeFileSync(
      configFile,
      "[req]\ndistinguished_name=dn\nprompt=no\nx509_extensions=v3_req\n[dn]\nCN=localhost\n[v3_req]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n",
    );
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyFile,
        "-out",
        certFile,
        "-days",
        "1",
        "-config",
        configFile,
      ],
      { stdio: "ignore" },
    );
    start(
      frontend,
      ["scripts/browser-https-proxy.mjs"],
      {
        BROWSER_RELEASE_CHECK: "1",
        BROWSER_TLS_CERT: certFile,
        BROWSER_TLS_KEY: keyFile,
      },
      "https-proxy.log",
    );
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: fullRelease });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  if (fullRelease) {
    async function mailLink(subject) {
      let link;
      await expect
        .poll(async () => {
          const response = await fetch("http://127.0.0.1:3102/outbox", {
            headers: { Authorization: `Bearer ${outboxToken}` },
          });
          const messages = await response.json();
          const message = messages.findLast(
            (item) => item.to === registeredEmail && item.subject === subject,
          );
          link = message?.text
            .split("\n")
            .find((line) => line.startsWith(`${base}/`));
          return !!link;
        })
        .toBe(true);
      return link;
    }
    await page.goto(`${base}/sign-up`);
    await page.getByLabel("Full name", { exact: false }).fill("Release Test");
    await page
      .getByLabel("Email address", { exact: false })
      .fill(registeredEmail);
    await page.locator('input[name="password"]').fill("release-test-password");
    await page
      .locator('input[name="confirmPassword"]')
      .fill("release-test-password");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Resend verification email", exact: true })
      .waitFor();
    await page.goto(await mailLink("Verify your RTN email address"));
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    await page
      .getByRole("button", { name: "Verify email", exact: true })
      .click();
    await page.getByText("Your email is verified.", { exact: false }).waitFor();
    await page.goto(`${base}/sign-in`);
    await page
      .getByLabel("Email address", { exact: false })
      .fill(registeredEmail);
    await page.locator('input[name="password"]').fill("release-test-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/onboarding$/);
    const sessionCookie = (await context.cookies()).find(
      (cookie) => cookie.name === "__Host-rtn-session",
    );
    assert.equal(sessionCookie?.secure, true);
    assert.equal(sessionCookie?.httpOnly, true);
    assert.equal(sessionCookie?.path, "/");

    await page
      .getByLabel("Business name", { exact: false })
      .fill("Week 8 release workspace");
    await page
      .getByLabel("Base currency", { exact: false })
      .selectOption("GBP");
    await page
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();
    await page.waitForURL(/\/dashboard$/);
    await page
      .getByRole("heading", { name: "Welcome to RTN", exact: true })
      .waitFor();
    const registration = await db.query(
      'SELECT "id" FROM "User" WHERE "email"=$1',
      [registeredEmail],
    );
    const registeredId = registration.rows[0].id;
    userIds.push(registeredId);
    const membership = await db.query(
      'SELECT "workspaceId" FROM "Membership" WHERE "userId"=$1',
      [registeredId],
    );
    workspaceIds.push(membership.rows[0].workspaceId);
    [userIds[0], userIds[userIds.length - 1]] = [
      userIds[userIds.length - 1],
      userIds[0],
    ];
    [workspaceIds[0], workspaceIds[workspaceIds.length - 1]] = [
      workspaceIds[workspaceIds.length - 1],
      workspaceIds[0],
    ];
    emails[0] = registeredEmail;
    ownerPassword = "release-reset-password";
    await db.query(
      'UPDATE "Membership" SET "workspaceId"=$1 WHERE "userId"=$2',
      [workspaceIds[0], userIds[1]],
    );

    await page.reload();
    await page
      .getByRole("heading", { name: "Welcome to RTN", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "Sign out", exact: true })
      .filter({ visible: true })
      .click();
    await page.waitForURL(/\/sign-in$/);
    await page.goto(`${base}/forgot-password`);
    await page
      .getByLabel("Email address", { exact: false })
      .fill(registeredEmail);
    await page
      .getByRole("button", { name: "Send reset instructions", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Check your inbox", exact: true })
      .waitFor();
    await page.goto(await mailLink("Reset your RTN password"));
    await page.locator('input[name="password"]').fill("release-reset-password");
    await page
      .locator('input[name="confirmPassword"]')
      .fill("release-reset-password");
    await page
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await page.waitForURL(/\/sign-in\?reset=success$/);
    await page
      .getByLabel("Email address", { exact: false })
      .fill(registeredEmail);
    await page.locator('input[name="password"]').fill("release-reset-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await page
      .getByRole("heading", { name: "Welcome to RTN", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Sign out", exact: true })
      .filter({ visible: true })
      .click();
    await page.waitForURL(/\/sign-in$/);
    console.log(
      "PASS: real registration, captured verification email, sign-in, onboarding, dashboard reload, sign-out and password reset",
    );
  }
  await login(page);
  await page.goto(`${base}/batches`);
  await page
    .getByRole("heading", { name: "No batches yet", exact: true })
    .waitFor();
  console.log("PASS: live empty batch catalogue");
  await page.goto(`${base}/batches/new`);
  await page
    .getByRole("heading", {
      name: "Add materials to calculate costs",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("link", { name: "Add your first material", exact: true })
    .click();
  await page.getByLabel("Material name", { exact: false }).fill("Almond oil");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption("Ingredient");
  await page.getByLabel("Purchase price (GBP)").fill("38.50");
  await page.getByLabel("Purchase quantity").fill("5");
  await page.getByLabel("Unit", { exact: false }).selectOption("L");
  await page.getByLabel("Stock quantity").fill("10");
  await page
    .getByRole("button", { name: "Create material", exact: true })
    .click();
  await page.waitForURL(/\/materials\/[0-9a-f-]+\/edit$/);
  const materialId = page.url().split("/").at(-2);
  await page.goto(`${base}/batches/new`);
  await fillBatch(page, materialId, "Live body wash", "LIVE-001");
  await page
    .getByRole("button", { name: "Add fixed cost", exact: true })
    .click();
  await page.getByLabel("Cost name", { exact: false }).fill("Labour");
  await page.getByLabel("Amount (GBP)", { exact: true }).fill("1.234567");
  await page.getByLabel("Notes (optional)").fill("Persist this formulation");
  const summary = page.locator('aside[aria-labelledby="live-cost-heading"]');
  await expect(summary.getByText("£7.01", { exact: true })).toBeVisible();
  await expect(summary.getByText("£0.5842", { exact: true })).toBeVisible();
  const previewPattern = "**/api/v1/workspaces/*/batches/preview";
  let releaseOld;
  let oldStarted = false;
  const oldPending = new Promise((resolve) => {
    releaseOld = resolve;
  });
  await page.route(previewPattern, async (route) => {
    if (route.request().postDataJSON().lines[0]?.quantity === "1000") {
      const response = await route.fetch();
      oldStarted = true;
      await oldPending;
      await route.fulfill({ response }).catch(() => undefined);
    } else await route.continue();
  });
  await page.getByLabel("Required quantity", { exact: false }).fill("1000");
  await expect(summary.getByText("£7.01", { exact: true })).toHaveCount(0);
  await expect.poll(() => oldStarted).toBe(true);
  await page.getByLabel("Required quantity", { exact: false }).fill("750");
  await expect(summary.getByText("£7.01", { exact: true })).toBeVisible();
  releaseOld();
  await page.unroute(previewPattern);
  await expect(summary.getByText("£8.93", { exact: true })).toHaveCount(0);
  await page.route(previewPattern, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.getByLabel("Required quantity", { exact: false }).fill("751");
  await expect(
    summary.getByText(
      "Unable to calculate costs. You can still save this draft.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(summary.getByText("£7.01", { exact: true })).toHaveCount(0);
  await page.unroute(previewPattern);
  await summary
    .getByRole("button", { name: "Retry calculation", exact: true })
    .click();
  await expect(summary.getByText("£7.01", { exact: true })).toBeVisible();
  await page.getByLabel("Required quantity", { exact: false }).fill("750");
  await expect(summary.getByText("£7.01", { exact: true })).toBeVisible();
  console.log(
    "PASS: backend preview, booked costs, stale-response protection and retry",
  );

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("Batch name", { exact: false })).toHaveValue(
    "Live body wash",
  );
  await expect(
    page.getByText(
      "Your unfinished batch was restored. Review it before saving.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page.getByLabel("Batch name", { exact: false }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByLabel("Batch reference", { exact: false })
      .evaluate((element) => element === document.activeElement),
    true,
    "keyboard advances to batch reference",
  );
  await audit(page, "builder");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `builder width ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: path.join(artifacts, "builder-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save draft batch", exact: true })
    .click();
  await page.waitForURL(/\/batches\/[0-9a-f-]+$/);
  await page
    .getByRole("heading", { name: "Live body wash", exact: true })
    .waitFor();
  const batchUrl = page.url(),
    batchId = batchUrl.split("/").at(-1);
  await page.getByText("Labour", { exact: true }).last().waitFor();
  const saved = await db.query(
    'SELECT "quantity"::text FROM "FormulationLine" WHERE "batchId"=$1',
    [batchId],
  );
  const costs = await db.query(
    'SELECT "amount"::text FROM "BatchFixedCost" WHERE "batchId"=$1',
    [batchId],
  );
  assert.equal(saved.rows[0].quantity, "750.000000");
  assert.equal(costs.rows[0].amount, "1.234567");
  await audit(page, "detail mobile");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `detail width ${width}`,
    );
  }
  await page.reload();
  await page
    .getByRole("heading", { name: "Live body wash", exact: true })
    .waitFor();
  const tab = await context.newPage();
  await tab.goto(batchUrl);
  await tab
    .getByRole("heading", { name: "Live body wash", exact: true })
    .waitFor();
  console.log(
    "PASS: material → formulation + fixed cost → save → reload/new-tab reopen; exact database decimals",
  );
  const dashboardTab = await context.newPage();
  const dashboardRequests = [];
  dashboardTab.on("request", (request) => {
    if (request.url().includes("/api/v1/workspaces/"))
      dashboardRequests.push(request.url());
  });
  await dashboardTab.goto(`${base}/dashboard`);
  await dashboardTab
    .getByRole("heading", { name: "Production overview", exact: true })
    .waitFor();
  await expect(
    dashboardTab.getByText("1 of 1 batches included.", { exact: false }),
  ).toBeVisible();
  await expect(
    dashboardTab.getByText("£7.01", { exact: true }).first(),
  ).toBeVisible();
  assert.equal(
    dashboardRequests.some((url) => /\/(materials|batches)(\?|$)/.test(url)),
    false,
    "dashboard uses only summary endpoint",
  );
  await audit(dashboardTab, "live dashboard");
  for (const width of [320, 390, 768, 1280]) {
    await dashboardTab.setViewportSize({ width, height: 900 });
    assert.equal(
      await dashboardTab.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `dashboard width ${width}`,
    );
  }
  await page.goto(`${base}/materials/${materialId}/edit`);
  await page.getByLabel("Purchase price (GBP)").fill("40.00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    dashboardTab.getByText("£7.23", { exact: true }).first(),
  ).toBeVisible();
  await expect(tab.getByText("£7.23", { exact: true })).toBeVisible();
  await page.getByLabel("Purchase price (GBP)").fill("38.50");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    dashboardTab.getByText("£7.01", { exact: true }).first(),
  ).toBeVisible();
  await dashboardTab.close();
  const dashboardPattern = "**/api/v1/workspaces/*/dashboard";
  await page.route(dashboardPattern, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("heading", { name: "Unable to load dashboard", exact: true })
    .waitFor();
  await page.unroute(dashboardPattern);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("heading", { name: "Production overview", exact: true })
    .waitFor();
  console.log(
    "PASS: summary-only dashboard, counts, exact costs, cross-tab material repricing, errors/retry and accessibility",
  );

  await page.goto(`${base}/batches`);
  await page
    .getByRole("link", { name: "Live body wash", exact: true })
    .first()
    .waitFor();
  await page.getByLabel("Search", { exact: false }).fill("missing");
  await page
    .getByRole("heading", { name: "No matching batches", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Status", { exact: false }).selectOption("Completed");
  await page
    .getByRole("heading", { name: "No matching batches", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await audit(page, "catalogue desktop");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `catalogue width ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await audit(page, "catalogue mobile");
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: path.join(artifacts, "catalogue-mobile.png"),
    fullPage: true,
  });
  console.log(
    "PASS: search/status/clear filters, 320–1280px layouts and axe accessibility checks",
  );
  const listPattern = `**/api/v1/workspaces/${workspaceIds[0]}/batches?*`;
  let releaseList;
  const listHeld = new Promise((resolve) => {
    releaseList = resolve;
  });
  await page.route(listPattern, async (route) => {
    await listHeld;
    await route.continue();
  });
  await page.reload();
  await page
    .getByRole("status")
    .filter({ hasText: "Loading batches" })
    .waitFor();
  releaseList();
  await page
    .getByRole("link", { name: "Live body wash", exact: true })
    .last()
    .waitFor();
  await page.unroute(listPattern);
  console.log("PASS: real catalogue loading state while the API is delayed");
  await page.route(listPattern, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Unable to load batches", exact: true })
    .waitFor();
  await page.unroute(listPattern);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("link", { name: "Live body wash", exact: true })
    .last()
    .waitFor();
  const detailPattern = `**/api/v1/workspaces/${workspaceIds[0]}/batches/${batchId}`;
  await page.route(detailPattern, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.goto(batchUrl);
  await page
    .getByRole("heading", { name: "Unable to load batch", exact: true })
    .waitFor();
  await page.unroute(detailPattern);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("heading", { name: "Live body wash", exact: true })
    .waitFor();
  await page.goto(`${base}/batches/${randomUUID()}`);
  await page
    .getByRole("heading", { name: "Batch not found", exact: true })
    .waitFor();
  console.log("PASS: list/detail errors, retry and unknown batch behavior");
  await page.goto(`${base}/batches/new`);
  await fillBatch(page, materialId, "Recovery batch", "RECOVER-001");
  await page.reload();
  await page
    .getByText("Your unfinished batch was restored. Review it before saving.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByLabel("Batch name", { exact: false }).inputValue(),
    "Recovery batch",
  );
  const createPattern = `**/api/v1/workspaces/${workspaceIds[0]}/batches`;
  await page.route(createPattern, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              fieldErrors: {
                "lines.0.quantity": ["Server rejected this quantity."],
              },
            },
          }),
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Save draft batch", exact: true })
    .click();
  await page
    .getByText("Server rejected this quantity.", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Required quantity", { exact: false }).inputValue(),
    "750",
  );
  await page.unroute(createPattern);
  await db.query(
    'UPDATE "AuthSession" SET "revokedAt"=now() WHERE "userId"=$1',
    [userIds[0]],
  );
  await page
    .getByRole("button", { name: "Save draft batch", exact: true })
    .click();
  await page.waitForURL("**/sign-in");
  await login(page);
  await page.goto(`${base}/batches/new`);
  await page
    .getByText("Your unfinished batch was restored. Review it before saving.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByLabel("Batch name", { exact: false }).inputValue(),
    "Recovery batch",
  );
  console.log(
    "PASS: server field errors, reload and real session-expiry recovery retain inputs",
  );
  let posts = 0;
  await page.route(createPattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Save draft batch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check saved batch", exact: true })
    .waitFor();
  await page.unroute(createPattern);
  await page
    .getByRole("button", { name: "Check saved batch", exact: true })
    .click();
  await page.waitForURL(/\/batches\/[0-9a-f-]+$/);
  await page
    .getByRole("heading", { name: "Recovery batch", exact: true })
    .waitFor();
  assert.equal(posts, 1);
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM "Batch" WHERE "workspaceId"=$1 AND "reference"=$2',
        [workspaceIds[0], "RECOVER-001"],
      )
    ).rows[0].count,
    1,
  );
  console.log(
    "PASS: lost creation response reconciles saved batch without duplicate POST",
  );
  for (const [unit, label, reference] of [
    ["kg", "Mass draft", "MASS-007"],
    ["item", "Empty draft", "EMPTY-007"],
  ]) {
    await page.goto(`${base}/batches/new`);
    await fillBatch(page, materialId, label, reference);
    await page.locator('select[name="outputUnit"]').selectOption(unit);
    if (label === "Empty draft")
      await page
        .getByRole("button", { name: "Remove formulation line 1", exact: true })
        .click();
    await expect(
      page.getByText(
        unit === "kg"
          ? "Cost calculation is available for item-output batches only. This draft can still be saved."
          : "Add a material to calculate costs. This draft can still be saved.",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save draft batch", exact: true })
      .click();
    await page.waitForURL(/\/batches\/[0-9a-f-]+$/);
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
  }
  console.log(
    "PASS: mass-output and empty drafts save and reopen without calculation",
  );
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("heading", { name: "Production overview", exact: true })
    .waitFor();
  await expect(page.getByText(/2 unavailable\./)).toBeVisible();
  await expect(
    page
      .locator('section[aria-labelledby="workspace-summary-heading"]')
      .getByText("£12.79", { exact: true }),
  ).toBeVisible();

  const member = await browser.newContext({ ignoreHTTPSErrors: fullRelease }),
    mp = await member.newPage();
  await login(mp, 1);
  await mp.goto(batchUrl);
  await mp
    .getByRole("heading", { name: "Live body wash", exact: true })
    .waitFor();
  await mp.goto(`${base}/batches`);
  await mp
    .getByRole("link", { name: "Live body wash", exact: true })
    .first()
    .waitFor();
  assert.equal(
    await mp.getByRole("link", { name: "Create batch", exact: true }).count(),
    0,
  );
  await mp.goto(`${base}/batches/new`);
  await mp
    .getByRole("heading", { name: "Batch creation is restricted", exact: true })
    .waitFor();
  const outsider = await browser.newContext({ ignoreHTTPSErrors: fullRelease }),
    op = await outsider.newPage();
  await login(op, 2);
  await op.goto(`${base}/batches`);
  await op
    .getByRole("heading", { name: "No batches yet", exact: true })
    .waitFor();
  await op.goto(batchUrl);
  await op
    .getByRole("heading", { name: "Batch not found", exact: true })
    .waitFor();
  assert.deepEqual(pageErrors, []);
  console.log(
    "PASS: member read access, restricted builder, tenant isolation and no browser exceptions",
  );
  console.log(`Screenshots and logs: ${artifacts}`);
})()
  .catch(async (error) => {
    const failedPage = browser?.contexts()[0]?.pages()[0];
    if (failedPage)
      await failedPage
        .screenshot({
          path: path.join(artifacts, "failure.png"),
          fullPage: true,
        })
        .catch(() => undefined);
    console.error(error);
    console.error(`Artifacts: ${artifacts}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    for (const item of processes) {
      try {
        process.kill(-item.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
    }
    if (tlsDirectory) fs.rmSync(tlsDirectory, { recursive: true, force: true });
    if (!connected) return;
    try {
      const registered = await db.query(
        'SELECT "id" FROM "User" WHERE "email"=$1',
        [registeredEmail],
      );
      if (registered.rows.length) {
        const id = registered.rows[0].id;
        if (!userIds.includes(id)) userIds.push(id);
        const memberships = await db.query(
          'SELECT "workspaceId" FROM "Membership" WHERE "userId"=$1',
          [id],
        );
        for (const row of memberships.rows)
          if (!workspaceIds.includes(row.workspaceId))
            workspaceIds.push(row.workspaceId);
      }
      await db.query(
        'DELETE FROM "Batch" WHERE "workspaceId"=ANY($1::uuid[])',
        [workspaceIds],
      );
      await db.query(
        'DELETE FROM "Material" WHERE "workspaceId"=ANY($1::uuid[])',
        [workspaceIds],
      );
      await db.query(
        'DELETE FROM "Membership" WHERE "workspaceId"=ANY($1::uuid[])',
        [workspaceIds],
      );
      await db.query('DELETE FROM "Workspace" WHERE "id"=ANY($1::uuid[])', [
        workspaceIds,
      ]);
      await db.query(
        'DELETE FROM "AuthSession" WHERE "userId"=ANY($1::uuid[])',
        [userIds],
      );
      await db.query('DELETE FROM "User" WHERE "id"=ANY($1::uuid[])', [
        userIds,
      ]);
    } finally {
      await db.end();
    }
  });
