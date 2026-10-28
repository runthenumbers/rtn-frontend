import type { MaterialUnit } from "../domain/material-units.ts";
export const batchStatuses = [
  "Draft",
  "Planned",
  "In production",
  "Completed",
] as const;
export type BatchStatus = (typeof batchStatuses)[number];
export type BatchLineCategory = "Material" | "Packaging" | "Production cost";
export interface BatchInput {
  name: string;
  reference: string;
  notes: string;
  plannedDate: string | null;
  targetOutputQuantity: string;
  outputUnitCode: MaterialUnit;
  lines: { materialId: string; quantity: string; unitCode: MaterialUnit }[];
  fixedCosts: { name: string; amount: string }[];
}
export interface Batch extends BatchInput {
  id: string;
  workspaceId: string;
  currencyCode: string;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  lines: (BatchInput["lines"][number] & { id: string })[];
  fixedCosts: (BatchInput["fixedCosts"][number] & { id: string })[];
}
export interface BatchLineViewModel {
  id: string;
  category: BatchLineCategory;
  name: string;
  quantity: string;
  lineCost: string | null;
}
export interface BatchViewModel {
  id: string;
  name: string;
  reference: string;
  notes: string;
  status: BatchStatus;
  date: string;
  dateLabel: string;
  output: string;
  yield: string;
  lines: BatchLineViewModel[];
  cost: {
    materials: string | null;
    packaging: string | null;
    production: string;
    total: string | null;
    unit: string | null;
  };
}
