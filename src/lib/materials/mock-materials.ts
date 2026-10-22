import { previewStorageKey } from "@/lib/onboarding/preview-scope";
import { isMaterialUnit, type MaterialUnit } from "@/lib/domain/material-units";

export const materialCategories = [
  "Ingredient",
  "Packaging",
  "Consumable",
] as const;

export type MaterialCategory = (typeof materialCategories)[number];
export type MaterialStockStatus = "In stock" | "Low stock" | "Out of stock";

export interface MaterialSummary {
  category: MaterialCategory;
  id: string;
  lastUpdated: string;
  name: string;
  packQuantity: number;
  purchasePrice: number;
  stockQuantity: number;
  stockStatus: MaterialStockStatus;
  supplier: string;
  unit: MaterialUnit;
}

export interface MaterialInput {
  category: MaterialCategory;
  name: string;
  packQuantity: number;
  purchasePrice: number;
  stockQuantity: number;
  supplier: string;
  unit: MaterialUnit;
}

const returningUserMaterials: readonly MaterialSummary[] = [
  {
    category: "Ingredient",
    id: "sweet-almond-oil",
    lastUpdated: "2026-09-22T14:35:00Z",
    name: "Sweet almond oil",
    packQuantity: 5,
    purchasePrice: 38.5,
    stockQuantity: 7.5,
    stockStatus: "In stock",
    supplier: "The Soapery",
    unit: "L",
  },
  {
    category: "Ingredient",
    id: "lavender-essential-oil",
    lastUpdated: "2026-09-20T09:10:00Z",
    name: "Lavender essential oil",
    packQuantity: 500,
    purchasePrice: 24.75,
    stockQuantity: 620,
    stockStatus: "Low stock",
    supplier: "Aromantic",
    unit: "ml",
  },
  {
    category: "Packaging",
    id: "amber-glass-bottle-250ml",
    lastUpdated: "2026-09-18T16:45:00Z",
    name: "Amber glass bottle, 250 ml",
    packQuantity: 48,
    purchasePrice: 52.8,
    stockQuantity: 86,
    stockStatus: "In stock",
    supplier: "Ampulla",
    unit: "item",
  },
  {
    category: "Packaging",
    id: "black-lotion-pump",
    lastUpdated: "2026-09-16T11:20:00Z",
    name: "Black lotion pump",
    packQuantity: 100,
    purchasePrice: 31,
    stockQuantity: 0,
    stockStatus: "Out of stock",
    supplier: "Stocksmetic",
    unit: "item",
  },
  {
    category: "Ingredient",
    id: "colloidal-oatmeal",
    lastUpdated: "2026-09-12T13:05:00Z",
    name: "Colloidal oatmeal",
    packQuantity: 1,
    purchasePrice: 12.4,
    stockQuantity: 2.4,
    stockStatus: "In stock",
    supplier: "Gracefruit",
    unit: "kg",
  },
  {
    category: "Consumable",
    id: "nitrile-gloves",
    lastUpdated: "2026-09-08T08:30:00Z",
    name: "Nitrile gloves",
    packQuantity: 100,
    purchasePrice: 8.95,
    stockQuantity: 34,
    stockStatus: "Low stock",
    supplier: "Cleanroom Shop",
    unit: "item",
  },
];

const emptyMaterials: readonly MaterialSummary[] = [];

export function getMockMaterials(journey: "new" | "returning") {
  if (typeof window === "undefined") {
    return journey === "returning" ? returningUserMaterials : emptyMaterials;
  }

  const rawValue = window.sessionStorage.getItem(storageKey(journey));
  const cache = materialCaches[journey];

  if (rawValue === cache.rawValue) {
    return cache.materials;
  }

  cache.rawValue = rawValue;

  if (!rawValue) {
    cache.materials =
      journey === "returning" ? returningUserMaterials : emptyMaterials;
    return cache.materials;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    cache.materials = isMaterialCollection(parsedValue)
      ? parsedValue
      : journey === "returning"
        ? returningUserMaterials
        : emptyMaterials;
  } catch {
    cache.materials =
      journey === "returning" ? returningUserMaterials : emptyMaterials;
  }

  return cache.materials;
}

const listeners = new Set<() => void>();
const materialCaches: Record<
  "new" | "returning",
  { materials: readonly MaterialSummary[]; rawValue?: string | null }
> = {
  new: { materials: emptyMaterials },
  returning: { materials: returningUserMaterials },
};

function storageKey(journey: "new" | "returning") {
  return previewStorageKey(`rtn:preview-materials:${journey}`);
}

function isMaterialCategory(value: unknown): value is MaterialCategory {
  return materialCategories.includes(value as MaterialCategory);
}

function isMaterialStockStatus(value: unknown): value is MaterialStockStatus {
  return (
    value === "In stock" || value === "Low stock" || value === "Out of stock"
  );
}

function isMaterial(value: unknown): value is MaterialSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const material = value as Record<string, unknown>;

  return (
    typeof material.id === "string" &&
    typeof material.name === "string" &&
    isMaterialCategory(material.category) &&
    typeof material.supplier === "string" &&
    typeof material.purchasePrice === "number" &&
    Number.isFinite(material.purchasePrice) &&
    typeof material.packQuantity === "number" &&
    Number.isFinite(material.packQuantity) &&
    typeof material.stockQuantity === "number" &&
    Number.isFinite(material.stockQuantity) &&
    typeof material.unit === "string" &&
    isMaterialUnit(material.unit) &&
    typeof material.lastUpdated === "string" &&
    isMaterialStockStatus(material.stockStatus)
  );
}

function isMaterialCollection(value: unknown): value is MaterialSummary[] {
  return Array.isArray(value) && value.every(isMaterial);
}

export function getMockMaterial(
  materialId: string,
  journey: "new" | "returning",
) {
  return getMockMaterials(journey).find(
    (material) => material.id === materialId,
  );
}

export function deriveStockStatus(
  stockQuantity: number,
  packQuantity: number,
): MaterialStockStatus {
  if (stockQuantity <= 0) {
    return "Out of stock";
  }

  return stockQuantity < packQuantity ? "Low stock" : "In stock";
}

export function subscribeToMockMaterials(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key?.startsWith("rtn:preview-materials:")) {
      materialCaches.new.rawValue = undefined;
      materialCaches.returning.rawValue = undefined;
      listener();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function saveMockMaterial(
  input: MaterialInput,
  journey: "new" | "returning",
  materialId?: string,
) {
  if (
    !input.name.trim() ||
    !input.supplier.trim() ||
    !isMaterialCategory(input.category) ||
    !isMaterialUnit(input.unit) ||
    !Number.isFinite(input.purchasePrice) ||
    input.purchasePrice <= 0 ||
    !Number.isFinite(input.packQuantity) ||
    input.packQuantity <= 0 ||
    !Number.isFinite(input.stockQuantity) ||
    input.stockQuantity < 0
  ) {
    throw new Error("INVALID_MATERIAL");
  }

  await new Promise((resolve) => window.setTimeout(resolve, 350));

  const materials = [...getMockMaterials(journey)];
  const existingIndex = materialId
    ? materials.findIndex((material) => material.id === materialId)
    : -1;

  if (materialId && existingIndex < 0) {
    throw new Error("MATERIAL_NOT_FOUND");
  }

  const id = materialId ?? createMaterialId(input.name, materials);
  const savedMaterial: MaterialSummary = {
    ...input,
    id,
    lastUpdated: new Date().toISOString(),
    name: input.name.trim(),
    stockStatus: deriveStockStatus(input.stockQuantity, input.packQuantity),
    supplier: input.supplier.trim(),
  };

  if (existingIndex >= 0) {
    materials[existingIndex] = savedMaterial;
  } else {
    materials.unshift(savedMaterial);
  }

  const rawValue = JSON.stringify(materials);
  window.sessionStorage.setItem(storageKey(journey), rawValue);
  materialCaches[journey] = { materials, rawValue };
  listeners.forEach((listener) => listener());

  return savedMaterial;
}

function createMaterialId(name: string, materials: readonly MaterialSummary[]) {
  const baseId =
    name
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "material";
  let id = baseId;
  let suffix = 2;

  while (materials.some((material) => material.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return id;
}
