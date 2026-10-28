import {
  getMaterialUnitDefinition,
  type MaterialUnit,
} from "../domain/material-units.ts";

export interface BatchCalculationLineInput {
  category: "Material" | "Packaging";
  materialId: string;
  packQuantity: string;
  purchasePrice: string;
  quantity: string;
  quantityUnit: MaterialUnit;
  purchaseUnit: MaterialUnit;
}

export interface BatchCalculationInput {
  lines: readonly BatchCalculationLineInput[];
  fixedCosts?: readonly { amount: string }[];
  targetOutputQuantity: string;
  targetOutputUnit: MaterialUnit;
}

export interface BatchCalculationLineResult {
  lineCost: string;
  materialId: string;
}

export interface BatchCalculationResult {
  costPerOutputUnit: string;
  lines: readonly BatchCalculationLineResult[];
  materialSubtotal: string;
  packagingSubtotal: string;
  fixedCostSubtotal: string;
  targetOutputQuantity: string;
  targetOutputUnit: MaterialUnit;
  totalBatchCost: string;
}

interface Fraction {
  denominator: bigint;
  numerator: bigint;
}

const MONEY_DECIMALS = 2;
const DETAIL_DECIMALS = 4;

export class BatchCalculationError extends Error {
  readonly code:
    | "INVALID_DECIMAL"
    | "NON_POSITIVE_VALUE"
    | "INCOMPATIBLE_UNITS"
    | "FRACTIONAL_COUNT";

  constructor(
    code:
      | "INVALID_DECIMAL"
      | "NON_POSITIVE_VALUE"
      | "INCOMPATIBLE_UNITS"
      | "FRACTIONAL_COUNT",
  ) {
    super(code);
    this.code = code;
  }
}

export function calculateBatchCost(
  input: BatchCalculationInput,
): BatchCalculationResult {
  const output = parsePositiveDecimal(input.targetOutputQuantity);
  assertWholeCount(output, input.targetOutputUnit);

  const lineFractions = input.lines.map((line) => {
    const quantity = parsePositiveDecimal(line.quantity);
    const packQuantity = parsePositiveDecimal(line.packQuantity);
    const purchasePrice = parsePositiveDecimal(line.purchasePrice);
    const quantityDefinition = getMaterialUnitDefinition(line.quantityUnit);
    const purchaseDefinition = getMaterialUnitDefinition(line.purchaseUnit);

    if (quantityDefinition.dimension !== purchaseDefinition.dimension) {
      throw new BatchCalculationError("INCOMPATIBLE_UNITS");
    }

    assertWholeCount(quantity, line.quantityUnit);
    assertWholeCount(packQuantity, line.purchaseUnit);

    return multiplyFractions(
      purchasePrice,
      divideFractions(
        multiplyFractionByInteger(quantity, quantityDefinition.baseUnits),
        multiplyFractionByInteger(packQuantity, purchaseDefinition.baseUnits),
      ),
    );
  });

  const fixedTotal = (input.fixedCosts ?? []).reduce(
    (sum, cost) => {
      const value =
        cost.amount === "0" || /^0\.0+$/.test(cost.amount)
          ? { numerator: 0n, denominator: 1n }
          : parsePositiveDecimal(cost.amount);
      return addFractions(sum, value);
    },
    { numerator: 0n, denominator: 1n },
  );
  const total = lineFractions.reduce(addFractions, fixedTotal);
  const costPerOutput = divideFractions(total, output);
  const materialSubtotal = lineFractions.reduce(
    (subtotal, cost, index) =>
      input.lines[index].category === "Material"
        ? addFractions(subtotal, cost)
        : subtotal,
    { numerator: 0n, denominator: 1n },
  );
  const packagingSubtotal = lineFractions.reduce(
    (subtotal, cost, index) =>
      input.lines[index].category === "Packaging"
        ? addFractions(subtotal, cost)
        : subtotal,
    { numerator: 0n, denominator: 1n },
  );

  return {
    fixedCostSubtotal: formatFraction(fixedTotal, MONEY_DECIMALS),
    costPerOutputUnit: formatFraction(costPerOutput, DETAIL_DECIMALS),
    lines: lineFractions.map((cost, index) => ({
      lineCost: formatFraction(cost, DETAIL_DECIMALS),
      materialId: input.lines[index].materialId,
    })),
    materialSubtotal: formatFraction(materialSubtotal, MONEY_DECIMALS),
    packagingSubtotal: formatFraction(packagingSubtotal, MONEY_DECIMALS),
    targetOutputQuantity: formatFraction(
      output,
      decimalPlaces(input.targetOutputQuantity),
    ),
    targetOutputUnit: input.targetOutputUnit,
    totalBatchCost: formatFraction(total, MONEY_DECIMALS),
  };
}

function parsePositiveDecimal(value: string): Fraction {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new BatchCalculationError("INVALID_DECIMAL");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const result = reduceFraction({
    numerator: BigInt(`${whole}${fraction}`),
    denominator,
  });
  if (result.numerator <= 0n) {
    throw new BatchCalculationError("NON_POSITIVE_VALUE");
  }
  return result;
}

function assertWholeCount(value: Fraction, unit: MaterialUnit) {
  if (
    getMaterialUnitDefinition(unit).dimension === "Count" &&
    value.numerator % value.denominator !== 0n
  ) {
    throw new BatchCalculationError("FRACTIONAL_COUNT");
  }
}

function addFractions(left: Fraction, right: Fraction): Fraction {
  return reduceFraction({
    numerator:
      left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function multiplyFractions(left: Fraction, right: Fraction): Fraction {
  return reduceFraction({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
}

function divideFractions(left: Fraction, right: Fraction): Fraction {
  return reduceFraction({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

function multiplyFractionByInteger(value: Fraction, factor: bigint): Fraction {
  return reduceFraction({
    numerator: value.numerator * factor,
    denominator: value.denominator,
  });
}

function reduceFraction(value: Fraction): Fraction {
  const divisor = greatestCommonDivisor(value.numerator, value.denominator);
  return {
    numerator: value.numerator / divisor,
    denominator: value.denominator / divisor,
  };
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function formatFraction(value: Fraction, places: number): string {
  const scale = 10n ** BigInt(places);
  const scaledNumerator = value.numerator * scale;
  let rounded = scaledNumerator / value.denominator;
  const remainder = scaledNumerator % value.denominator;
  if (remainder * 2n >= value.denominator) {
    rounded += 1n;
  }
  const raw = rounded.toString().padStart(places + 1, "0");
  return places === 0 ? raw : `${raw.slice(0, -places)}.${raw.slice(-places)}`;
}

function decimalPlaces(value: string) {
  return Math.min(value.trim().split(".")[1]?.length ?? 0, 4);
}
