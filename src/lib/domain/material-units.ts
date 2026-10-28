export const materialUnitGroups = [
  {
    dimension: "Mass",
    units: [
      { value: "g", label: "Gram", abbreviation: "g" },
      { value: "kg", label: "Kilogram", abbreviation: "kg" },
    ],
  },
  {
    dimension: "Volume",
    units: [
      { value: "ml", label: "Millilitre", abbreviation: "ml" },
      { value: "L", label: "Litre", abbreviation: "L" },
    ],
  },
  {
    dimension: "Count",
    units: [{ value: "item", label: "Item", abbreviation: "item" }],
  },
] as const;

export type MaterialUnit =
  (typeof materialUnitGroups)[number]["units"][number]["value"];

export interface MaterialUnitOption {
  abbreviation: string;
  label: string;
  value: MaterialUnit;
}

export const materialUnits: readonly MaterialUnitOption[] =
  materialUnitGroups.flatMap(
    (group) => group.units as readonly MaterialUnitOption[],
  );

export type MeasurementDimension = "Mass" | "Volume" | "Count";

const unitDefinitions: Record<
  MaterialUnit,
  { baseUnits: bigint; dimension: MeasurementDimension }
> = {
  g: { baseUnits: 1n, dimension: "Mass" },
  kg: { baseUnits: 1000n, dimension: "Mass" },
  ml: { baseUnits: 1n, dimension: "Volume" },
  L: { baseUnits: 1000n, dimension: "Volume" },
  item: { baseUnits: 1n, dimension: "Count" },
};

const supportedUnits = new Set<string>(
  materialUnitGroups.flatMap((group) => group.units.map((unit) => unit.value)),
);

export function isMaterialUnit(value: string): value is MaterialUnit {
  return supportedUnits.has(value);
}

export function getMaterialUnitDefinition(unit: MaterialUnit) {
  return unitDefinitions[unit];
}

export function getCompatibleMaterialUnits(unit: MaterialUnit) {
  const dimension = getMaterialUnitDefinition(unit).dimension;
  return materialUnitGroups
    .filter((group) => group.dimension === dimension)
    .flatMap((group) => group.units as readonly MaterialUnitOption[]);
}

export function formatMaterialQuantity(
  quantity: number | string,
  unit: MaterialUnit,
) {
  const formattedQuantity = new Intl.NumberFormat("en", {
    maximumFractionDigits: 6,
  }).format(Number(quantity));

  if (unit === "item") {
    return `${formattedQuantity} ${Number(quantity) === 1 ? "item" : "items"}`;
  }

  return `${formattedQuantity} ${unit}`;
}
