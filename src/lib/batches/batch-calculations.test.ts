import assert from "node:assert/strict";

import {
  BatchCalculationError,
  calculateBatchCost,
} from "./batch-calculations.ts";

const result = calculateBatchCost({
  lines: [
    {
      category: "Material",
      materialId: "oil",
      packQuantity: "5",
      purchasePrice: "38.50",
      purchaseUnit: "L",
      quantity: "750",
      quantityUnit: "ml",
    },
    {
      category: "Packaging",
      materialId: "bottle",
      packQuantity: "48",
      purchasePrice: "52.80",
      purchaseUnit: "item",
      quantity: "12",
      quantityUnit: "item",
    },
  ],
  targetOutputQuantity: "12",
  targetOutputUnit: "item",
});

assert.deepEqual(result, {
  fixedCostSubtotal: "0.00",
  costPerOutputUnit: "1.5813",
  lines: [
    { lineCost: "5.7750", materialId: "oil" },
    { lineCost: "13.2000", materialId: "bottle" },
  ],
  materialSubtotal: "5.78",
  packagingSubtotal: "13.20",
  targetOutputQuantity: "12",
  targetOutputUnit: "item",
  totalBatchCost: "18.98",
});

assert.throws(
  () =>
    calculateBatchCost({
      lines: [
        {
          category: "Material",
          materialId: "oil",
          packQuantity: "1",
          purchasePrice: "10",
          purchaseUnit: "L",
          quantity: "1",
          quantityUnit: "kg",
        },
      ],
      targetOutputQuantity: "1",
      targetOutputUnit: "item",
    }),
  (error) =>
    error instanceof BatchCalculationError &&
    error.code === "INCOMPATIBLE_UNITS",
);

assert.throws(
  () =>
    calculateBatchCost({
      lines: [
        {
          category: "Packaging",
          materialId: "bottle",
          packQuantity: "12",
          purchasePrice: "6",
          purchaseUnit: "item",
          quantity: "1.5",
          quantityUnit: "item",
        },
      ],
      targetOutputQuantity: "1",
      targetOutputUnit: "item",
    }),
  (error) =>
    error instanceof BatchCalculationError && error.code === "FRACTIONAL_COUNT",
);

console.log("Batch calculation vectors passed.");
