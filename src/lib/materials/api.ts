import { isMaterialUnit } from "../domain/material-units.ts";
import {
  deriveStockStatus,
  validDecimal,
  type MaterialInput,
  type MaterialSummary,
  type MaterialCategory,
} from "./types.ts";

const labels: Record<string, MaterialCategory> = {
  INGREDIENT: "Ingredient",
  PACKAGING: "Packaging",
  CONSUMABLE: "Consumable",
};
const codes: Record<MaterialCategory, string> = {
  Ingredient: "INGREDIENT",
  Packaging: "PACKAGING",
  Consumable: "CONSUMABLE",
};
export class MaterialError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;
  constructor(status: number, fieldErrors: Record<string, string[]> = {}) {
    super("Unable to load or save materials.");
    this.name = "MaterialError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
export function parseMaterial(
  value: unknown,
  workspaceId: string,
): MaterialSummary {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    value.workspaceId !== workspaceId ||
    typeof value.name !== "string" ||
    typeof value.category !== "string" ||
    !Object.hasOwn(labels, value.category) ||
    !(value.supplier === null || typeof value.supplier === "string") ||
    typeof value.purchasePrice !== "string" ||
    !validDecimal(value.purchasePrice, true) ||
    typeof value.packQuantity !== "string" ||
    !validDecimal(value.packQuantity, true) ||
    typeof value.stockQuantity !== "string" ||
    !validDecimal(value.stockQuantity) ||
    typeof value.currencyCode !== "string" ||
    !/^[A-Z]{3}$/.test(value.currencyCode) ||
    typeof value.unitCode !== "string" ||
    !isMaterialUnit(value.unitCode) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw new MaterialError(502);
  return {
    id: value.id,
    workspaceId,
    name: value.name,
    category: labels[value.category],
    supplier: value.supplier ?? "",
    purchasePrice: value.purchasePrice,
    packQuantity: value.packQuantity,
    stockQuantity: value.stockQuantity,
    currencyCode: value.currencyCode,
    unit: value.unitCode,
    stockStatus: deriveStockStatus(value.stockQuantity, value.packQuantity),
    lastUpdated: value.updatedAt,
  };
}
async function request(
  workspaceId: string,
  materialId?: string,
  input?: MaterialInput,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/materials${materialId ? "/" + encodeURIComponent(materialId) : ""}`,
    {
      method: input ? (materialId ? "PUT" : "POST") : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: input ? { "Content-Type": "application/json" } : undefined,
      body: input
        ? JSON.stringify({
            name: input.name.trim(),
            category: codes[input.category],
            supplier: input.supplier.trim() || null,
            purchasePrice: input.purchasePrice,
            packQuantity: input.packQuantity,
            stockQuantity: input.stockQuantity,
            currencyCode: input.currencyCode,
            unitCode: input.unit,
          })
        : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const fields: Record<string, string[]> = {};
    if (
      record(payload) &&
      record(payload.error) &&
      record(payload.error.fieldErrors)
    ) {
      for (const [field, messages] of Object.entries(
        payload.error.fieldErrors,
      )) {
        if (
          Array.isArray(messages) &&
          messages.every((message) => typeof message === "string")
        )
          fields[field === "unitCode" ? "unit" : field] = messages;
      }
    }
    throw new MaterialError(response.status, fields);
  }
  return payload;
}
export async function listMaterials(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<MaterialSummary[]> {
  const payload = await request(workspaceId, undefined, undefined, signal);
  if (!record(payload) || !Array.isArray(payload.items))
    throw new MaterialError(502);
  return payload.items.map((item) => parseMaterial(item, workspaceId));
}
export async function getMaterial(
  workspaceId: string,
  materialId: string,
  signal?: AbortSignal,
): Promise<MaterialSummary> {
  const result = parseMaterial(
    await request(workspaceId, materialId, undefined, signal),
    workspaceId,
  );
  if (result.id !== materialId) throw new MaterialError(502);
  return result;
}
export async function saveMaterial(
  workspaceId: string,
  input: MaterialInput,
  materialId?: string,
): Promise<MaterialSummary> {
  const result = parseMaterial(
    await request(workspaceId, materialId, input),
    workspaceId,
  );
  if (materialId && result.id !== materialId) throw new MaterialError(502);
  return result;
}
