import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  listMaterials,
  getMaterial,
  saveMaterial,
  MaterialError,
  parseMaterial,
} from "./api.ts";
import {
  deriveStockStatus,
  validDecimal,
  type MaterialInput,
} from "./types.ts";

afterEach(() => mock.restoreAll());
const wire = {
  id: "material-id",
  workspaceId: "workspace-id",
  name: "Shea butter",
  category: "INGREDIENT",
  supplier: null,
  purchasePrice: "12.345678",
  packQuantity: "1.250001",
  stockQuantity: "0.000000",
  currencyCode: "GBP",
  unitCode: "kg",
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:00:00.000Z",
};
const input: MaterialInput = {
  name: "  Shea butter  ",
  category: "Ingredient",
  supplier: "",
  purchasePrice: "12.345678",
  packQuantity: "1.250001",
  stockQuantity: "0",
  currencyCode: "GBP",
  unit: "kg",
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
test("maps API records without converting decimals to floating point", () => {
  const item = parseMaterial(wire, wire.workspaceId);
  assert.equal(item.category, "Ingredient");
  assert.equal(item.supplier, "");
  assert.equal(item.purchasePrice, "12.345678");
  assert.equal(item.packQuantity, "1.250001");
  assert.equal(item.stockStatus, "Out of stock");
  assert.equal(item.unit, "kg");
});
test("lists a genuinely empty persisted catalogue", async () => {
  const fetch = respond(200, { items: [] });
  assert.deepEqual(await listMaterials(wire.workspaceId), []);
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/workspaces/workspace-id/materials");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.cache, "no-store");
});
test("POST serializes only allowed fields and preserves decimal strings", async () => {
  const fetch = respond(201);
  await saveMaterial(wire.workspaceId, {
    ...input,
    userId: "forged",
  } as MaterialInput);
  const [, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(options.method, "POST");
  assert.deepEqual(JSON.parse(options.body as string), {
    name: "Shea butter",
    category: "INGREDIENT",
    supplier: null,
    purchasePrice: "12.345678",
    packQuantity: "1.250001",
    stockQuantity: "0",
    currencyCode: "GBP",
    unitCode: "kg",
  });
});
test("PUT saves a full replacement to the selected workspace/material path", async () => {
  const fetch = respond(200);
  await saveMaterial(wire.workspaceId, input, wire.id);
  const [url, options] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "/api/v1/workspaces/workspace-id/materials/material-id");
  assert.equal(options.method, "PUT");
});
test("GET detail rejects a response for another material", async () => {
  respond(200);
  await assert.rejects(
    getMaterial(wire.workspaceId, "another-id"),
    MaterialError,
  );
});
for (const invalid of [
  { workspaceId: "other-tenant" },
  { purchasePrice: 12 },
  { purchasePrice: "1.1234567" },
  { packQuantity: "0" },
  { stockQuantity: "-1" },
  { stockQuantity: "NaN" },
  { category: "toString" },
  { unitCode: "unknown" },
  { updatedAt: "invalid-date" },
  { supplier: 42 },
]) {
  test(`rejects malformed material response ${JSON.stringify(invalid)}`, () => {
    assert.throws(
      () => parseMaterial({ ...wire, ...invalid }, wire.workspaceId),
      MaterialError,
    );
  });
}
test("a mismatched tenant invalidates the entire list rather than leaking or hiding records", async () => {
  respond(200, { items: [wire, { ...wire, workspaceId: "other-tenant" }] });
  await assert.rejects(listMaterials(wire.workspaceId), MaterialError);
});
for (const status of [400, 401, 403, 404, 500]) {
  test(`preserves status ${status} and maps unit field errors`, async () => {
    respond(status, {
      error: { fieldErrors: { unitCode: ["Unsupported unit"], unsafe: [42] } },
    });
    await assert.rejects(
      saveMaterial(wire.workspaceId, input),
      (error: unknown) => {
        assert.ok(error instanceof MaterialError);
        assert.equal(error.status, status);
        assert.deepEqual(error.fieldErrors, { unit: ["Unsupported unit"] });
        return true;
      },
    );
  });
}
test("network failures propagate and never trigger an automatic duplicate POST", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Unavailable");
  });
  await assert.rejects(saveMaterial(wire.workspaceId, input), TypeError);
  assert.equal(fetch.mock.callCount(), 1);
});
test("stock status compares exact decimals even at the maximum supported magnitude", () => {
  assert.equal(
    deriveStockStatus("99999999999999.999998", "99999999999999.999999"),
    "Low stock",
  );
  assert.equal(deriveStockStatus("1.000001", "1.000001"), "In stock");
  assert.equal(deriveStockStatus("0", "0.000001"), "Out of stock");
});
test("decimal validation rejects exponents, leading zeros, negatives and excess precision", () => {
  for (const value of [
    "1e2",
    "01",
    "-1",
    "1.1234567",
    "100000000000000",
    "NaN",
    "Infinity",
  ])
    assert.equal(validDecimal(value), false);
  assert.equal(validDecimal("0"), true);
  assert.equal(validDecimal("0", true), false);
  assert.equal(validDecimal("0.000001", true), true);
});
