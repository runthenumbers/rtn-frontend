import { apiClient } from "@/lib/api/client";

export interface CurrencyOption {
    code: string;
    name: string;
    symbol: string;
    minorUnitScale: number
}

export type UnitDimension = "MASS" | "VOLUME" | "COUNT"

export interface UnitOption {
    code: string;
    label: string;
    abbreviation: string;
    dimension: UnitDimension
}

export interface Catalogues {
    currencies: CurrencyOption[];
    units: UnitOption[],
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isCurrencyOption(value: unknown): value is CurrencyOption{
      return (
        isRecord(value) &&
        typeof value.code === "string" &&
        /^[A-Z]{3}$/.test(value.code) &&
        typeof value.name === "string" &&
        value.name.length > 0 &&
        typeof value.symbol === "string" &&
        value.symbol.length > 0 &&
        value.minorUnitScale === 2
    );
}

function isUnitOption(value: unknown): value is UnitOption {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.label === "string" &&
    value.label.length > 0 &&
    typeof value.abbreviation === "string" &&
    value.abbreviation.length > 0 &&
    (value.dimension === "MASS" ||
      value.dimension === "VOLUME" ||
      value.dimension === "COUNT")
  );
}

function parseItems<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): T[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    !value.items.every(isItem)
  ) {
    throw new Error("The catalogue response is invalid.");
  }

  return value.items;
}

async function fetchCatalogue(path: string, signal: AbortSignal): Promise<unknown> {
    if(!apiClient.defaults.baseURL){
        throw new Error("The catalogue API URL is not configured.");
    }

    const response = await apiClient.get<unknown>(`/v1/catalogues/${path}`, {signal})

    return response.data
}


export async function loadCatalogues(signal: AbortSignal): Promise<Catalogues> {
    const [currenciesResponse, unitsResponse] = await Promise.all([
        fetchCatalogue('currencies', signal),
        fetchCatalogue('units', signal)
    ]);

    return {
        currencies: parseItems(currenciesResponse, isCurrencyOption),
        units: parseItems(unitsResponse, isUnitOption)
    }
}