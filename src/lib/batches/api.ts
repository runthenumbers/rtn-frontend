import { isMaterialUnit } from "../domain/material-units.ts";
import { validDecimal } from "../materials/types.ts";
import type { Batch, BatchInput, BatchStatus } from "./types.ts";
export class BatchError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;
  constructor(status: number, fieldErrors: Record<string, string[]> = {}) {
    super("Unable to load or save batches.");
    this.name = "BatchError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const statuses: Record<string, BatchStatus> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  IN_PRODUCTION: "In production",
  COMPLETED: "Completed",
};
function decimal(value: unknown, positive = false): value is string {
  return typeof value === "string" && validDecimal(value, positive);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
export function parseBatch(value: unknown, workspaceId: string): Batch {
  if (
    !record(value) ||
    !text(value.id) ||
    value.workspaceId !== workspaceId ||
    !text(value.name) ||
    !text(value.reference) ||
    typeof value.notes !== "string" ||
    typeof value.status !== "string" ||
    !Object.hasOwn(statuses, value.status) ||
    !(
      value.plannedDate === null ||
      (typeof value.plannedDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.plannedDate) &&
        Number.isFinite(Date.parse(value.plannedDate)) &&
        new Date(value.plannedDate).toISOString().slice(0, 10) ===
          value.plannedDate)
    ) ||
    !decimal(value.targetOutputQuantity, true) ||
    typeof value.outputUnitCode !== "string" ||
    !isMaterialUnit(value.outputUnitCode) ||
    typeof value.currencyCode !== "string" ||
    !/^[A-Z]{3}$/.test(value.currencyCode) ||
    !text(value.createdAt) ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !text(value.updatedAt) ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.lines) ||
    !Array.isArray(value.fixedCosts)
  )
    throw new BatchError(502);
  const id = value.id;
  const lines = value.lines.map((line: unknown) => {
    if (
      !record(line) ||
      !text(line.id) ||
      line.batchId !== id ||
      line.workspaceId !== workspaceId ||
      !text(line.materialId) ||
      !decimal(line.quantity, true) ||
      typeof line.unitCode !== "string" ||
      !isMaterialUnit(line.unitCode)
    )
      throw new BatchError(502);
    return {
      id: line.id,
      materialId: line.materialId,
      quantity: line.quantity,
      unitCode: line.unitCode,
    };
  });
  if (new Set(lines.map((line) => line.materialId)).size !== lines.length)
    throw new BatchError(502);
  const fixedCosts = value.fixedCosts.map((cost: unknown) => {
    if (
      !record(cost) ||
      !text(cost.id) ||
      cost.batchId !== id ||
      !text(cost.name) ||
      !decimal(cost.amount)
    )
      throw new BatchError(502);
    return { id: cost.id, name: cost.name, amount: cost.amount };
  });
  return {
    id,
    workspaceId,
    name: value.name,
    reference: value.reference,
    notes: value.notes,
    plannedDate: value.plannedDate,
    status: statuses[value.status],
    targetOutputQuantity: value.targetOutputQuantity,
    outputUnitCode: value.outputUnitCode,
    currencyCode: value.currencyCode,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lines,
    fixedCosts,
  };
}
async function request(
  workspaceId: string,
  suffix: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/batches${suffix}`,
    {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
      for (const [key, messages] of Object.entries(payload.error.fieldErrors)) {
        if (
          Array.isArray(messages) &&
          messages.every((message) => typeof message === "string")
        )
          fields[key] = messages;
      }
    }
    throw new BatchError(response.status, fields);
  }
  return payload;
}
export async function listBatches(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<Batch[]> {
  const items: Batch[] = [];
  // Fetch every page so catalogue filters never silently omit older batches.
  for (let offset = 0; ; offset += 100) {
    const payload = await request(
      workspaceId,
      `?limit=100&offset=${offset}`,
      "GET",
      undefined,
      signal,
    );
    if (!record(payload) || !Array.isArray(payload.items))
      throw new BatchError(502);
    const page = payload.items.map((item) => parseBatch(item, workspaceId));
    items.push(...page);
    if (page.length < 100) return items;
  }
}
export async function getBatch(
  workspaceId: string,
  id: string,
  signal?: AbortSignal,
): Promise<Batch> {
  const batch = parseBatch(
    await request(
      workspaceId,
      `/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      signal,
    ),
    workspaceId,
  );
  if (batch.id !== id) throw new BatchError(502);
  return batch;
}
export async function saveBatch(
  workspaceId: string,
  input: BatchInput,
  id?: string,
): Promise<Batch> {
  const body: BatchInput = {
    name: input.name.trim(),
    reference: input.reference.trim(),
    notes: input.notes,
    plannedDate: input.plannedDate,
    targetOutputQuantity: input.targetOutputQuantity,
    outputUnitCode: input.outputUnitCode,
    lines: input.lines.map((line) => ({
      materialId: line.materialId,
      quantity: line.quantity,
      unitCode: line.unitCode,
    })),
    fixedCosts: input.fixedCosts.map((cost) => ({
      name: cost.name.trim(),
      amount: cost.amount,
    })),
  };
  const batch = parseBatch(
    await request(
      workspaceId,
      id ? `/${encodeURIComponent(id)}` : "",
      id ? "PUT" : "POST",
      body,
    ),
    workspaceId,
  );
  if (id && batch.id !== id) throw new BatchError(502);
  return batch;
}
