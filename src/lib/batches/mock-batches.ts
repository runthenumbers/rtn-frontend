import { previewStorageKey } from "@/lib/onboarding/preview-scope";
export const batchStatuses = ["Planned", "In production", "Completed"] as const;

export type BatchStatus = (typeof batchStatuses)[number];
export type BatchLineCategory = "Material" | "Packaging" | "Production cost";

export interface BatchLineViewModel {
  category: BatchLineCategory;
  id: string;
  lineCost: string;
  name: string;
  quantity: string;
}

export interface BatchCostSummary {
  materials: string;
  packaging: string;
  production: string;
  total: string;
  unit: string;
}

export interface BatchViewModel {
  cost: BatchCostSummary;
  date: string;
  dateLabel: "Planned date" | "Completed date";
  id: string;
  lines: readonly BatchLineViewModel[];
  name: string;
  notes: string;
  output: string;
  reference: string;
  status: BatchStatus;
  yield: string;
}

export interface BatchInput {
  calculation: {
    costPerOutputUnit: string;
    materialSubtotal: string;
    packagingSubtotal: string;
    totalBatchCost: string;
  };
  date: string;
  lines: readonly BatchLineViewModel[];
  name: string;
  notes: string;
  output: string;
  reference: string;
}

const returningUserBatches: readonly BatchViewModel[] = [
  {
    cost: {
      materials: "168.20",
      packaging: "126.00",
      production: "24.40",
      total: "318.60",
      unit: "2.66",
    },
    date: "2026-09-21",
    dateLabel: "Completed date",
    id: "citrus-body-wash-0926",
    lines: [
      {
        category: "Material",
        id: "sweet-almond-oil",
        lineCost: "46.20",
        name: "Sweet almond oil",
        quantity: "6 L",
      },
      {
        category: "Material",
        id: "citrus-surfactant-blend",
        lineCost: "98.00",
        name: "Citrus surfactant blend",
        quantity: "24 kg",
      },
      {
        category: "Material",
        id: "preservative-eco",
        lineCost: "24.00",
        name: "Preservative Eco",
        quantity: "600 ml",
      },
      {
        category: "Packaging",
        id: "amber-glass-bottle-250ml",
        lineCost: "88.00",
        name: "Amber glass bottle, 250 ml",
        quantity: "120 items",
      },
      {
        category: "Packaging",
        id: "black-lotion-pump",
        lineCost: "38.00",
        name: "Black lotion pump",
        quantity: "120 items",
      },
      {
        category: "Production cost",
        id: "mixing-and-filling",
        lineCost: "24.40",
        name: "Mixing and filling",
        quantity: "4 hours",
      },
    ],
    name: "Citrus body wash",
    notes:
      "Completed production run for the autumn wholesale allocation. Output reflects accepted filled units after line checks.",
    output: "120 × 250 ml bottles",
    reference: "BW-2026-019",
    status: "Completed",
    yield: "96.0% yield",
  },
  {
    cost: {
      materials: "92.40",
      packaging: "78.00",
      production: "24.00",
      total: "194.40",
      unit: "4.05",
    },
    date: "2026-09-29",
    dateLabel: "Planned date",
    id: "amber-candle-0926",
    lines: [
      {
        category: "Material",
        id: "soy-wax",
        lineCost: "63.60",
        name: "Soy wax",
        quantity: "9.6 kg",
      },
      {
        category: "Material",
        id: "cedar-fragrance-oil",
        lineCost: "28.80",
        name: "Cedar fragrance oil",
        quantity: "960 ml",
      },
      {
        category: "Packaging",
        id: "amber-candle-jar",
        lineCost: "60.00",
        name: "Amber candle jar",
        quantity: "48 items",
      },
      {
        category: "Packaging",
        id: "cotton-wick",
        lineCost: "18.00",
        name: "Cotton wick",
        quantity: "48 items",
      },
      {
        category: "Production cost",
        id: "pouring-and-finishing",
        lineCost: "24.00",
        name: "Pouring and finishing",
        quantity: "3 hours",
      },
    ],
    name: "Amber candle",
    notes:
      "Planned small run for the seasonal range. Allow the full cure period before final quality review and packing.",
    output: "48 × 200 g candles",
    reference: "CA-2026-011",
    status: "Planned",
    yield: "100% planned yield",
  },
  {
    cost: {
      materials: "145.56",
      packaging: "57.60",
      production: "23.40",
      total: "226.56",
      unit: "2.36",
    },
    date: "2026-09-18",
    dateLabel: "Completed date",
    id: "oat-cleansing-bar-0926",
    lines: [
      {
        category: "Material",
        id: "soap-base",
        lineCost: "116.16",
        name: "Gentle soap base",
        quantity: "12 kg",
      },
      {
        category: "Material",
        id: "colloidal-oatmeal",
        lineCost: "29.40",
        name: "Colloidal oatmeal",
        quantity: "2.4 kg",
      },
      {
        category: "Packaging",
        id: "kraft-soap-box",
        lineCost: "57.60",
        name: "Kraft soap box",
        quantity: "96 items",
      },
      {
        category: "Production cost",
        id: "moulding-and-packing",
        lineCost: "23.40",
        name: "Moulding and packing",
        quantity: "3 hours",
      },
    ],
    name: "Oat cleansing bar",
    notes:
      "Completed core-range replenishment. Four bars were retained for stability and quality samples.",
    output: "96 × 125 g bars",
    reference: "SB-2026-024",
    status: "Completed",
    yield: "96.0% yield",
  },
  {
    cost: {
      materials: "311.84",
      packaging: "185.00",
      production: "48.00",
      total: "544.84",
      unit: "5.45",
    },
    date: "2026-09-25",
    dateLabel: "Planned date",
    id: "lavender-hand-lotion-0926",
    lines: [
      {
        category: "Material",
        id: "lotion-base",
        lineCost: "264.00",
        name: "Natural lotion base",
        quantity: "24 kg",
      },
      {
        category: "Material",
        id: "lavender-essential-oil",
        lineCost: "47.84",
        name: "Lavender essential oil",
        quantity: "800 ml",
      },
      {
        category: "Packaging",
        id: "amber-glass-bottle-250ml",
        lineCost: "140.00",
        name: "Amber glass bottle, 250 ml",
        quantity: "100 items",
      },
      {
        category: "Packaging",
        id: "black-lotion-pump",
        lineCost: "45.00",
        name: "Black lotion pump",
        quantity: "100 items",
      },
      {
        category: "Production cost",
        id: "blending-and-filling",
        lineCost: "48.00",
        name: "Blending and filling",
        quantity: "6 hours",
      },
    ],
    name: "Lavender hand lotion",
    notes:
      "Currently in production for the October retail launch. Final output will be recorded after filling and quality checks.",
    output: "100 × 250 ml bottles",
    reference: "HL-2026-007",
    status: "In production",
    yield: "100% planned yield",
  },
];

const emptyBatches: readonly BatchViewModel[] = [];

export function getMockBatches(journey: "new" | "returning") {
  const defaults =
    journey === "returning" ? returningUserBatches : emptyBatches;
  if (typeof window === "undefined") {
    return defaults;
  }

  const rawValue = window.sessionStorage.getItem(storageKey(journey));
  const cache = batchCaches[journey];
  if (cache.rawValue === rawValue) {
    return cache.batches;
  }

  cache.rawValue = rawValue;
  if (!rawValue) {
    cache.batches = defaults;
    return cache.batches;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    cache.batches = isBatchCollection(parsedValue) ? parsedValue : defaults;
  } catch {
    cache.batches = defaults;
  }
  return cache.batches;
}

export function getMockBatch(batchId: string, journey: "new" | "returning") {
  return getMockBatches(journey).find((batch) => batch.id === batchId);
}

const listeners = new Set<() => void>();
const batchCaches: Record<
  "new" | "returning",
  { batches: readonly BatchViewModel[]; rawValue?: string | null }
> = {
  new: { batches: emptyBatches },
  returning: { batches: returningUserBatches },
};

function storageKey(journey: "new" | "returning") {
  return previewStorageKey(`rtn:preview-batches:${journey}`);
}

function isBatchCollection(value: unknown): value is BatchViewModel[] {
  return Array.isArray(value) && value.every(isBatch);
}

function isBatch(value: unknown): value is BatchViewModel {
  if (!value || typeof value !== "object") return false;
  const batch = value as Record<string, unknown>;
  const cost = batch.cost as Record<string, unknown> | undefined;
  return (
    typeof batch.id === "string" &&
    typeof batch.name === "string" &&
    typeof batch.reference === "string" &&
    typeof batch.date === "string" &&
    (batch.dateLabel === "Planned date" ||
      batch.dateLabel === "Completed date") &&
    (batch.status === "Planned" ||
      batch.status === "In production" ||
      batch.status === "Completed") &&
    typeof batch.output === "string" &&
    typeof batch.yield === "string" &&
    typeof batch.notes === "string" &&
    Array.isArray(batch.lines) &&
    batch.lines.every(isBatchLine) &&
    !!cost &&
    ["materials", "packaging", "production", "total", "unit"].every(
      (key) => typeof cost[key] === "string",
    )
  );
}

function isBatchLine(value: unknown): value is BatchLineViewModel {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    typeof line.name === "string" &&
    typeof line.quantity === "string" &&
    typeof line.lineCost === "string" &&
    (line.category === "Material" ||
      line.category === "Packaging" ||
      line.category === "Production cost")
  );
}

export function subscribeToMockBatches(listener: () => void) {
  listeners.add(listener);
  function handleStorage(event: StorageEvent) {
    if (event.key?.startsWith("rtn:preview-batches:")) {
      batchCaches.new.rawValue = undefined;
      batchCaches.returning.rawValue = undefined;
      listener();
    }
  }
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function saveMockBatch(
  input: BatchInput,
  journey: "new" | "returning",
) {
  if (
    input.name.trim().length < 2 ||
    input.reference.trim().length < 2 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    input.lines.length === 0
  ) {
    throw new Error("INVALID_BATCH");
  }

  await new Promise((resolve) => window.setTimeout(resolve, 350));
  const batches = [...getMockBatches(journey)];
  if (
    batches.some(
      (batch) =>
        batch.reference.toLocaleLowerCase() ===
        input.reference.trim().toLocaleLowerCase(),
    )
  ) {
    throw new Error("DUPLICATE_REFERENCE");
  }

  const id = createBatchId(input.name, batches);
  const savedBatch: BatchViewModel = {
    cost: {
      materials: input.calculation.materialSubtotal,
      packaging: input.calculation.packagingSubtotal,
      production: "0.00",
      total: input.calculation.totalBatchCost,
      unit: input.calculation.costPerOutputUnit,
    },
    date: input.date,
    dateLabel: "Planned date",
    id,
    lines: input.lines,
    name: input.name.trim(),
    notes:
      input.notes.trim() ||
      "Planned production batch. Costs reflect the saved formulation and current material purchase details.",
    output: input.output,
    reference: input.reference.trim(),
    status: "Planned",
    yield: "100% planned yield",
  };
  batches.unshift(savedBatch);
  const rawValue = JSON.stringify(batches);
  window.sessionStorage.setItem(storageKey(journey), rawValue);
  batchCaches[journey] = { batches, rawValue };
  listeners.forEach((listener) => listener());
  return savedBatch;
}

function createBatchId(name: string, batches: readonly BatchViewModel[]) {
  const baseId =
    name
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "batch";
  let id = baseId;
  let suffix = 2;
  while (batches.some((batch) => batch.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
}
