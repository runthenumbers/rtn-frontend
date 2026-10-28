/* Runs only against a disposable local PostgreSQL database; never production. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
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
if (
  !databaseUrl ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    "Set BROWSER_TEST_DATABASE_URL to a disposable local PostgreSQL database with the backend migrations applied.",
  );
}
const db = new Client({ connectionString: databaseUrl });
const base = "http://localhost:3100";
const backendOrigin = "http://127.0.0.1:3101";
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "rtn-week6-"));
const userIds = [],
  workspaceIds = [randomUUID(), randomUUID()],
  emails = [];
const processes = [];
let browser;
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
  await page.locator('input[name="password"]').fill("browser-test-password");
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
    ["dist/main.js"],
    {
      NODE_ENV: "development",
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
  start(
    frontend,
    ["node_modules/next/dist/bin/next", "dev", "--port", "3100"],
    { API_URL: backendOrigin, NEXT_TELEMETRY_DISABLED: "1" },
    "frontend.log",
  );
  await ready(`${base}/sign-in`);
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await login(page);
  await page.goto(`${base}/batches`);
  await page
    .getByRole("heading", { name: "No batches yet", exact: true })
    .waitFor();
  console.log("PASS: live empty batch catalogue");
  await page.goto(`${base}/batches/new`);
  await page
    .getByRole("heading", {
      name: "Add materials before building a batch",
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
  const member = await browser.newContext(),
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
  const outsider = await browser.newContext(),
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
    if (!connected) return;
    try {
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
