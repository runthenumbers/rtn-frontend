import { isMaterialUnit, type MaterialUnit } from "../domain/material-units.ts";
import type { BatchStatus } from "../batches/types.ts";
export interface Dashboard {
  workspaceId: string;
  currencyCode: string;
  generatedAt: string;
  materialCount: number;
  batchCount: number;
  statusCounts: Record<
    "DRAFT" | "PLANNED" | "IN_PRODUCTION" | "COMPLETED",
    number
  >;
  estimatedCosts: {
    total: string | null;
    calculatedBatchCount: number;
    unavailableBatchCount: number;
  };
  recentBatches: {
    id: string;
    name: string;
    reference: string;
    status: BatchStatus;
    createdAt: string;
    targetOutputQuantity: string;
    outputUnitCode: MaterialUnit;
    totalBatchCost: string | null;
    costPerOutputUnit: string | null;
    unavailableReason: string | null;
  }[];
}
export class DashboardError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("Unable to load dashboard.");
    this.name = "DashboardError";
    this.status = status;
  }
}
const statuses: Record<string, BatchStatus> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  IN_PRODUCTION: "In production",
  COMPLETED: "Completed",
};
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function money(value: unknown, scale: number): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^\\d{1,100}\\.\\d{${scale}}$`).test(value)
  );
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function date(value: unknown): value is string {
  return text(value) && Number.isFinite(Date.parse(value));
}
export function parseDashboard(value: unknown, workspaceId: string): Dashboard {
  if (
    !record(value) ||
    value.workspaceId !== workspaceId ||
    !text(value.currencyCode) ||
    !/^[A-Z]{3}$/.test(value.currencyCode) ||
    !date(value.generatedAt) ||
    !count(value.materialCount) ||
    !count(value.batchCount) ||
    !record(value.statusCounts) ||
    !record(value.estimatedCosts) ||
    !Array.isArray(value.recentBatches) ||
    value.recentBatches.length !== Math.min(value.batchCount, 3)
  )
    throw new DashboardError(502);
  const costs = value.estimatedCosts;
  if (
    !count(costs.calculatedBatchCount) ||
    !count(costs.unavailableBatchCount) ||
    costs.calculatedBatchCount + costs.unavailableBatchCount !==
      value.batchCount ||
    !(costs.total === null || money(costs.total, 2)) ||
    (costs.total === null) !==
      (value.batchCount > 0 && costs.calculatedBatchCount === 0)
  )
    throw new DashboardError(502);
  let statusTotal = 0;
  for (const key of Object.keys(statuses)) {
    const entry = value.statusCounts[key];
    if (!count(entry)) throw new DashboardError(502);
    statusTotal += entry;
  }
  if (statusTotal !== value.batchCount) throw new DashboardError(502);
  const recentBatches = value.recentBatches.map((batch: unknown) => {
    if (
      !record(batch) ||
      !text(batch.id) ||
      !text(batch.name) ||
      !text(batch.reference) ||
      typeof batch.status !== "string" ||
      !Object.hasOwn(statuses, batch.status) ||
      !date(batch.createdAt) ||
      typeof batch.targetOutputQuantity !== "string" ||
      !/^(?=.*[1-9])\d{1,14}(?:\.\d{1,6})?$/.test(batch.targetOutputQuantity) ||
      typeof batch.outputUnitCode !== "string" ||
      !isMaterialUnit(batch.outputUnitCode) ||
      !(batch.totalBatchCost === null || money(batch.totalBatchCost, 2)) ||
      !(
        batch.costPerOutputUnit === null || money(batch.costPerOutputUnit, 6)
      ) ||
      !(batch.unavailableReason === null || text(batch.unavailableReason)) ||
      (batch.totalBatchCost === null) !== (batch.costPerOutputUnit === null) ||
      (batch.totalBatchCost === null) !== (batch.unavailableReason !== null)
    )
      throw new DashboardError(502);
    return {
      ...batch,
      status: statuses[batch.status],
    } as Dashboard["recentBatches"][number];
  });
  if (
    new Set(recentBatches.map((batch) => batch.id)).size !==
    recentBatches.length
  )
    throw new DashboardError(502);
  return { ...value, recentBatches } as unknown as Dashboard;
}
export async function getDashboard(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<Dashboard> {
  const response = await fetch(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/dashboard`,
    {
      credentials: "same-origin",
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new DashboardError(response.status);
  return parseDashboard(await response.json().catch(() => null), workspaceId);
}
