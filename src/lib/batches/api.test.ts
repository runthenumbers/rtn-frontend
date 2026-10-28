import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  BatchError,
  getBatch,
  listBatches,
  parseBatch,
  saveBatch,
} from "./api.ts";
import type { BatchInput } from "./types.ts";
import { batchView } from "./view-model.ts";
import { draftKey, parseDraft } from "./draft.ts";
import { calculateBatchCost } from "./batch-calculations.ts";
const workspaceId = "workspace-id";
const wire = {
  id: "batch-id",
  workspaceId,
  name: "Body wash",
  reference: "BW-001",
  notes: "",
  status: "DRAFT",
  plannedDate: null,
  targetOutputQuantity: "12.000000",
  outputUnitCode: "item",
  currencyCode: "GBP",
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:00:00.000Z",
  lines: [
    {
      id: "line-id",
      batchId: "batch-id",
      workspaceId,
      materialId: "material-id",
      quantity: "750.000000",
      unitCode: "ml",
      position: 0,
    },
  ],
  fixedCosts: [
    {
      id: "cost-id",
      batchId: "batch-id",
      name: "Labour",
      amount: "1.234567",
      position: 0,
    },
  ],
};
const input: BatchInput = {
  name: "  Body wash ",
  reference: " BW-001 ",
  notes: "",
  plannedDate: null,
  targetOutputQuantity: "12",
  outputUnitCode: "item",
  lines: [{ materialId: "material-id", quantity: "750", unitCode: "ml" }],
  fixedCosts: [{ name: " Labour ", amount: "1.234567" }],
};
function respond(status: number, body: unknown = wire) {
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
afterEach(() => mock.restoreAll());
test("parses saved decimal strings, draft status and nullable schedule", () => {
  const batch = parseBatch(wire, workspaceId);
  assert.equal(batch.status, "Draft");
  assert.equal(batch.plannedDate, null);
  assert.equal(batch.lines[0].quantity, "750.000000");
  assert.equal(batch.fixedCosts[0].amount, "1.234567");
});
test("POST whitelists fields and never submits client calculations, status or tenant ownership", async () => {
  const fetch = respond(201);
  await saveBatch(workspaceId, {
    ...input,
    status: "COMPLETED",
    workspaceId: "foreign",
    lines: [{ ...input.lines[0], workspaceId: "foreign", lineCost: "0" }],
  } as unknown as BatchInput);
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/workspaces/workspace-id/batches");
  assert.equal(options.method, "POST");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.cache, "no-store");
  assert.deepEqual(JSON.parse(options.body as string), {
    ...input,
    name: "Body wash",
    reference: "BW-001",
    fixedCosts: [{ name: "Labour", amount: "1.234567" }],
  });
});
test("PUT performs a full replacement of the selected saved draft", async () => {
  const fetch = respond(200);
  await saveBatch(
    workspaceId,
    { ...input, lines: [], fixedCosts: [] },
    wire.id,
  );
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/workspaces/workspace-id/batches/batch-id");
  assert.equal(options.method, "PUT");
  assert.deepEqual(JSON.parse(options.body as string).lines, []);
});
test("list fetches every page so filtering does not omit batches after the first 100", async () => {
  const calls: string[] = [];
  mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(url);
    return new Response(
      JSON.stringify({
        items:
          calls.length === 1
            ? Array.from({ length: 100 }, (_, i) => ({
                ...wire,
                id: `id-${i}`,
                lines: [],
                fixedCosts: [],
              }))
            : [wire],
      }),
    );
  });
  const items = await listBatches(workspaceId);
  assert.equal(items.length, 101);
  assert.match(calls[1], /offset=100/);
});
test("empty live lists remain empty without sample fallback", async () => {
  respond(200, { items: [] });
  assert.deepEqual(await listBatches(workspaceId), []);
});
test("detail checks the requested ID", async () => {
  respond(200);
  await assert.rejects(getBatch(workspaceId, "another"), BatchError);
});
for (const invalid of [
  { workspaceId: "foreign" },
  { status: "toString" },
  { status: "Unknown" },
  { plannedDate: "2026-02-30" },
  { targetOutputQuantity: 12 },
  { targetOutputQuantity: "0" },
  { outputUnitCode: "bad" },
  { currencyCode: "bad" },
  { lines: [{ ...wire.lines[0], workspaceId: "foreign" }] },
  { lines: [{ ...wire.lines[0], batchId: "foreign" }] },
  { lines: [{ ...wire.lines[0], quantity: "1.1234567" }] },
  { fixedCosts: [{ ...wire.fixedCosts[0], amount: "-1" }] },
  { fixedCosts: [{ ...wire.fixedCosts[0], batchId: "foreign" }] },
  { updatedAt: "invalid" },
])
  test(`rejects invalid or foreign saved data ${JSON.stringify(invalid)}`, () =>
    assert.throws(
      () => parseBatch({ ...wire, ...invalid }, workspaceId),
      BatchError,
    ));
for (const status of [400, 401, 403, 404, 409, 500])
  test(`preserves HTTP ${status} and nested validation fields`, async () => {
    respond(status, {
      error: {
        fieldErrors: {
          "lines.0.quantity": ["Invalid quantity"],
          "fixedCosts.0.amount": ["Invalid amount"],
          unsafe: [42],
        },
      },
    });
    await assert.rejects(saveBatch(workspaceId, input), (error: unknown) => {
      assert.ok(error instanceof BatchError);
      assert.equal(error.status, status);
      assert.deepEqual(error.fieldErrors, {
        "lines.0.quantity": ["Invalid quantity"],
        "fixedCosts.0.amount": ["Invalid amount"],
      });
      return true;
    });
  });
test("network failure does not automatically retry a creation", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Network error");
  });
  await assert.rejects(saveBatch(workspaceId, input), TypeError);
  assert.equal(fetch.mock.callCount(), 1);
});
test("current estimates include saved fixed costs without rounding intermediate totals", () => {
  const batch = parseBatch(wire, workspaceId);
  const view = batchView(batch, [
    {
      id: "material-id",
      workspaceId,
      name: "Oil",
      category: "Ingredient",
      supplier: "",
      purchasePrice: "38.50",
      packQuantity: "5",
      stockQuantity: "0",
      currencyCode: "GBP",
      unit: "L",
      stockStatus: "Out of stock",
      lastUpdated: wire.updatedAt,
    },
  ]);
  assert.equal(view.lines[0].name, "Oil");
  assert.equal(view.lines[0].lineCost, "5.7750");
  assert.equal(view.cost.production, "1.23");
  assert.equal(view.cost.total, "7.01");
  assert.equal(view.cost.unit, "0.5841");
  assert.equal(view.lines[1].lineCost, "1.234567");
});
test("saved quantities and fixed costs remain readable when material prices are unavailable", () => {
  const view = batchView(parseBatch(wire, workspaceId), []);
  assert.equal(view.cost.total, null);
  assert.equal(view.lines[0].quantity, "750 ml");
  assert.equal(view.cost.production, "1.23");
});
test("fixed cost summation is exact and rejects negative amounts", () => {
  const result = calculateBatchCost({
    lines: [],
    fixedCosts: [{ amount: "0.005" }, { amount: "0.005" }, { amount: "0" }],
    targetOutputQuantity: "3",
    targetOutputUnit: "item",
  });
  assert.equal(result.totalBatchCost, "0.01");
  assert.equal(result.costPerOutputUnit, "0.0033");
  assert.throws(() =>
    calculateBatchCost({
      lines: [],
      fixedCosts: [{ amount: "-1" }],
      targetOutputQuantity: "1",
      targetOutputUnit: "item",
    }),
  );
});
test("recovery keys isolate accounts and workspaces, and drafts preserve incomplete decimal text", () => {
  assert.notEqual(
    draftKey("user-a", "workspace-a"),
    draftKey("user-b", "workspace-a"),
  );
  assert.notEqual(
    draftKey("user-a", "workspace-a"),
    draftKey("user-a", "workspace-b"),
  );
  const draft = {
    name: "Draft",
    reference: "",
    date: "",
    outputQuantity: "1.",
    outputUnit: "",
    notes: "",
    lines: [{ id: "line-1", materialId: "", quantity: "0.", unit: "" }],
    fixedCosts: [],
  };
  assert.deepEqual(parseDraft(JSON.stringify(draft)), draft);
  assert.equal(parseDraft("invalid"), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, lines: [null] })), null);
  assert.equal(parseDraft(JSON.stringify({ ...draft, lines: [] })), null);
});
