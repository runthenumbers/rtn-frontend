import { calculateBatchCost } from "./batch-calculations.ts";
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
  let calculation: ReturnType<typeof calculateBatchCost> | undefined;
  try {
    if (resolved.some((item) => !item.material))
      throw new Error("Material unavailable");
    calculation = calculateBatchCost({
      targetOutputQuantity: batch.targetOutputQuantity,
      targetOutputUnit: batch.outputUnitCode,
      fixedCosts: batch.fixedCosts,
      lines: resolved.map(({ line, material }) => ({
        materialId: line.materialId,
        category: material!.category === "Packaging" ? "Packaging" : "Material",
        packQuantity: material!.packQuantity,
        purchasePrice: material!.purchasePrice,
        purchaseUnit: material!.unit,
        quantity: line.quantity,
        quantityUnit: line.unitCode,
      })),
    });
  } catch {
    /* Saved quantities remain readable when a current estimate is unavailable. */
  }
  const fixedOnly = calculateBatchCost({
    lines: [],
    fixedCosts: batch.fixedCosts,
    targetOutputQuantity: batch.targetOutputQuantity,
    targetOutputUnit: batch.outputUnitCode,
  });
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
        name: material?.name ?? "Material unavailable",
        category:
          material?.category === "Packaging"
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
      production: fixedOnly.fixedCostSubtotal,
      total: calculation?.totalBatchCost ?? null,
      unit: calculation?.costPerOutputUnit ?? null,
    },
  };
}
