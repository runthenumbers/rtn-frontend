import type { BatchViewModel } from "@/lib/batches/mock-batches";
import type { MaterialSummary } from "@/lib/materials/types";

export interface RecentBatchSummary {
  costPerUnit: string;
  id: string;
  name: string;
  output: string;
  status: BatchViewModel["status"];
  totalCost: string;
}

export interface DashboardViewModel {
  batchCount: number;
  materialCount: number;
  recentBatches: readonly RecentBatchSummary[];
  recordedBatchCosts: string;
}

export function getMockDashboard(
  materials: readonly MaterialSummary[],
  batches: readonly BatchViewModel[],
): DashboardViewModel {
  return {
    batchCount: batches.length,
    materialCount: materials.length,
    recentBatches: batches.slice(0, 3).map((batch) => ({
      costPerUnit: batch.cost.unit,
      id: batch.id,
      name: batch.name,
      output: batch.output,
      status: batch.status,
      totalCost: batch.cost.total,
    })),
    recordedBatchCosts: batches
      .reduce((total, batch) => total + Number(batch.cost.total), 0)
      .toFixed(2),
  };
}

export function formatCurrency(amount: number | string, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
