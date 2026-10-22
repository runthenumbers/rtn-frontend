import { previewStorageKey } from "@/lib/onboarding/preview-scope";
import {
  isBusinessType,
  isCountryCode,
  type BusinessType,
  type CountryCode,
} from "@/lib/domain/business-options";
import { isCurrencyCode, type CurrencyCode } from "@/lib/domain/currencies";

export interface MockWorkspace {
  baseCurrency: CurrencyCode;
  businessName: string;
  businessType?: BusinessType;
  country?: CountryCode;
  secondaryCurrency?: CurrencyCode;
}

export const returningUserWorkspace: MockWorkspace = {
  baseCurrency: "GBP",
  businessName: "Northstar Formulations",
  businessType: "beauty-personal-care",
  country: "GB",
  secondaryCurrency: "EUR",
};

function storageKey() {
  return previewStorageKey("rtn:preview-workspace");
}
const listeners = new Set<() => void>();
let cachedRawValue: string | null | undefined;
let cachedWorkspace: MockWorkspace | null = null;

function isMockWorkspace(value: unknown): value is MockWorkspace {
  if (!value || typeof value !== "object") {
    return false;
  }

  const workspace = value as Record<string, unknown>;

  return (
    typeof workspace.businessName === "string" &&
    workspace.businessName.trim().length >= 2 &&
    typeof workspace.baseCurrency === "string" &&
    isCurrencyCode(workspace.baseCurrency) &&
    (workspace.secondaryCurrency === undefined ||
      (typeof workspace.secondaryCurrency === "string" &&
        isCurrencyCode(workspace.secondaryCurrency))) &&
    workspace.secondaryCurrency !== workspace.baseCurrency &&
    (workspace.businessType === undefined ||
      (typeof workspace.businessType === "string" &&
        isBusinessType(workspace.businessType))) &&
    (workspace.country === undefined ||
      (typeof workspace.country === "string" &&
        isCountryCode(workspace.country)))
  );
}

export function getMockWorkspaceSnapshot(): MockWorkspace | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(storageKey());

  if (rawValue === cachedRawValue) {
    return cachedWorkspace;
  }

  cachedRawValue = rawValue;

  if (!rawValue) {
    cachedWorkspace = null;
    return cachedWorkspace;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    cachedWorkspace = isMockWorkspace(parsedValue) ? parsedValue : null;
  } catch {
    cachedWorkspace = null;
  }

  return cachedWorkspace;
}

export function getMockWorkspaceServerSnapshot() {
  return null;
}

export function subscribeToMockWorkspace(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === storageKey()) {
      cachedRawValue = undefined;
      listener();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveMockWorkspace(workspace: MockWorkspace) {
  const rawValue = JSON.stringify(workspace);
  window.sessionStorage.setItem(storageKey(), rawValue);
  cachedRawValue = rawValue;
  cachedWorkspace = workspace;
  listeners.forEach((listener) => listener());
}

export function clearMockWorkspace() {
  window.sessionStorage.removeItem(storageKey());
  cachedRawValue = null;
  cachedWorkspace = null;
  listeners.forEach((listener) => listener());
}
