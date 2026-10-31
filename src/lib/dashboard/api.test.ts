import {
  formatCurrencyDecimal,
  formatUnitCostDecimal,
} from "../domain/currencies.ts";
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { DashboardError, getDashboard, parseDashboard } from "./api.ts";
const wire = {
  workspaceId: "workspace",
  currencyCode: "GBP",
  generatedAt: "2026-10-31T12:00:00Z",
  materialCount: 2,
  batchCount: 2,
  statusCounts: { DRAFT: 2, PLANNED: 0, IN_PRODUCTION: 0, COMPLETED: 0 },
  estimatedCosts: {
    total: "7.01",
    calculatedBatchCount: 1,
    unavailableBatchCount: 1,
  },
  recentBatches: [
    {
      id: "a",
      name: "A",
      reference: "A-1",
      status: "DRAFT",
      createdAt: "2026-10-31T12:00:00Z",
      targetOutputQuantity: "12.000000",
      outputUnitCode: "item",
      totalBatchCost: "7.01",
      costPerOutputUnit: "0.584167",
      unavailableReason: null,
    },
    {
      id: "b",
      name: "B",
      reference: "B-1",
      status: "DRAFT",
      createdAt: "2026-10-30T12:00:00Z",
      targetOutputQuantity: "0.500000",
      outputUnitCode: "kg",
      totalBatchCost: null,
      costPerOutputUnit: null,
      unavailableReason: "Item outputs only",
    },
  ],
};
afterEach(() => mock.restoreAll());
test("parses partial coverage and server totals without calculating from recent batches", () => {
  const parsed = parseDashboard(
    {
      ...wire,
      estimatedCosts: { ...wire.estimatedCosts, total: "199999999999999.98" },
    },
    "workspace",
  );
  assert.equal(parsed.estimatedCosts.total, "199999999999999.98");
  assert.equal(parsed.recentBatches[0].status, "Draft");
  assert.equal(parsed.recentBatches[1].unavailableReason, "Item outputs only");
});
test("empty workspace and all-unavailable costs are distinct", () => {
  const empty = {
    ...wire,
    batchCount: 0,
    statusCounts: { DRAFT: 0, PLANNED: 0, IN_PRODUCTION: 0, COMPLETED: 0 },
    estimatedCosts: {
      total: "0.00",
      calculatedBatchCount: 0,
      unavailableBatchCount: 0,
    },
    recentBatches: [],
  };
  assert.equal(parseDashboard(empty, "workspace").estimatedCosts.total, "0.00");
  const missing = {
    ...wire,
    batchCount: 1,
    statusCounts: { ...wire.statusCounts, DRAFT: 1 },
    estimatedCosts: {
      total: null,
      calculatedBatchCount: 0,
      unavailableBatchCount: 1,
    },
    recentBatches: [wire.recentBatches[1]],
  };
  assert.equal(parseDashboard(missing, "workspace").estimatedCosts.total, null);
});
test("rejects foreign, malformed and internally inconsistent dashboard data", () => {
  for (const override of [
    { workspaceId: "other" },
    { currencyCode: "bad" },
    { batchCount: NaN },
    { materialCount: -1 },
    { generatedAt: "bad" },
    { statusCounts: { ...wire.statusCounts, DRAFT: 1 } },
    { estimatedCosts: { ...wire.estimatedCosts, total: 7.01 } },
    { estimatedCosts: { ...wire.estimatedCosts, total: null } },
    { estimatedCosts: { ...wire.estimatedCosts, calculatedBatchCount: 2 } },
    { recentBatches: [] },
    { recentBatches: [wire.recentBatches[0], wire.recentBatches[0]] },
    {
      recentBatches: [
        { ...wire.recentBatches[0], status: "toString" },
        wire.recentBatches[1],
      ],
    },
    {
      recentBatches: [
        { ...wire.recentBatches[0], totalBatchCost: null },
        wire.recentBatches[1],
      ],
    },
  ])
    assert.throws(
      () => parseDashboard({ ...wire, ...override }, "workspace"),
      DashboardError,
    );
});
test("requests a single tenant-scoped uncached summary and propagates abort", async () => {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify(wire)),
  );
  const controller = new AbortController();
  await getDashboard("workspace", controller.signal);
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/workspaces/workspace/dashboard");
  assert.equal(options.cache, "no-store");
  assert.equal(options.credentials, "same-origin");
  controller.abort();
  assert.equal(options.signal?.aborted, true);
});
for (const status of [401, 403, 404, 500])
  test(`preserves HTTP ${status} without a sample fallback`, async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("{}", { status }),
    );
    await assert.rejects(
      getDashboard("workspace"),
      (error) => error instanceof DashboardError && error.status === status,
    );
  });

test("formats authoritative money without losing pennies on large values", () => {
  assert.equal(
    formatCurrencyDecimal("199999999999999.98", "GBP"),
    "£199,999,999,999,999.98",
  );
  assert.equal(formatCurrencyDecimal("0.005000", "GBP"), "£0.01");
  assert.equal(formatUnitCostDecimal("0.584167", "GBP"), "£0.5842");
  assert.equal(formatUnitCostDecimal("-0.000050", "GBP"), "-£0.0001");
});
