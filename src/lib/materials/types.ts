export const materialCategories = [
  "Ingredient",
  "Packaging",
  "Consumable",
] as const;
export type MaterialCategory = (typeof materialCategories)[number];
export type MaterialStockStatus = "In stock" | "Low stock" | "Out of stock";
import type { MaterialUnit } from "../domain/material-units.ts";

export interface MaterialSummary {
  id: string;
  workspaceId: string;
  name: string;
  category: MaterialCategory;
  supplier: string;
  purchasePrice: string;
  packQuantity: string;
  stockQuantity: string;
  currencyCode: string;
  unit: MaterialUnit;
  stockStatus: MaterialStockStatus;
  lastUpdated: string;
}
export interface MaterialInput {
  name: string;
  category: MaterialCategory;
  supplier: string;
  purchasePrice: string;
  packQuantity: string;
  stockQuantity: string;
  currencyCode: string;
  unit: MaterialUnit;
}

export const decimalPattern = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;
export function validDecimal(value: string, positive = false): boolean {
  return decimalPattern.test(value) && (!positive || /[1-9]/.test(value));
}
export function scaledDecimal(value: string): bigint {
  if (!validDecimal(value)) throw new Error("Invalid material decimal");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(6, "0"));
}
export function deriveStockStatus(
  stockQuantity: string,
  packQuantity: string,
): MaterialStockStatus {
  const stock = scaledDecimal(stockQuantity);
  return stock === 0n
    ? "Out of stock"
    : stock < scaledDecimal(packQuantity)
      ? "Low stock"
      : "In stock";
}
