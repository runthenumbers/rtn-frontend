import { formatMaterialQuantity } from "../domain/material-units.ts";
import type { MaterialSummary } from "../materials/types.ts";
import type { Batch, BatchViewModel } from "./types.ts";
export function batchView(
  batch: Batch,
  materials: readonly MaterialSummary[],
): BatchViewModel {
  const resolved = batch.lines.map((line) => ({
    line,
    material: materials.find(
      (material) =>
        material.id === line.materialId &&
        material.workspaceId === batch.workspaceId &&
        material.currencyCode === batch.currencyCode,
    ),
  }));
  const calculation =
    batch.calculation.status === "available" ? batch.calculation : undefined;
  return {
    id: batch.id,
    name: batch.name,
    reference: batch.reference,
    notes: batch.notes,
    status: batch.status,
    date: batch.plannedDate ?? "",
    dateLabel: "Planned date",
    output: formatMaterialQuantity(
      batch.targetOutputQuantity,
      batch.outputUnitCode,
    ),
    yield: "Actual yield not recorded",
    lines: [
      ...resolved.map(({ line, material }, index) => ({
        id: line.id,
        name:
          calculation?.lines[index]?.name ??
          material?.name ??
          "Material unavailable",
        category: (
          calculation
            ? calculation.lines[index]?.category === "PACKAGING"
            : material?.category === "Packaging"
        )
          ? ("Packaging" as const)
          : ("Material" as const),
        quantity: formatMaterialQuantity(line.quantity, line.unitCode),
        lineCost: calculation?.lines[index].lineCost ?? null,
      })),
      ...batch.fixedCosts.map((cost) => ({
        id: cost.id,
        name: cost.name,
        category: "Production cost" as const,
        quantity: "Fixed cost",
        lineCost: cost.amount,
      })),
    ],
    cost: {
      materials: calculation?.materialSubtotal ?? null,
      packaging: calculation?.packagingSubtotal ?? null,
      production: calculation?.fixedCostSubtotal ?? null,
      total: calculation?.totalBatchCost ?? null,
      unit: calculation?.costPerOutputUnit ?? null,
    },
  };
}
