import { parseWorkspaceContext, type WorkspaceContext } from "../auth/api.ts";

export interface BusinessSettingsInput {
  businessName: string;
  businessType: string | null;
  country: string | null;
  baseCurrency: string;
  secondaryCurrency: string | null;
}

export class SettingsError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;
  constructor(status: number, fieldErrors: Record<string, string[]> = {}) {
    super("Unable to save or load business settings.");
    this.name = "SettingsError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function request(
  workspaceId: string,
  input?: BusinessSettingsInput,
  signal?: AbortSignal,
): Promise<WorkspaceContext> {
  const response = await fetch(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: input ? "PUT" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: input ? { "Content-Type": "application/json" } : undefined,
      body: input
        ? JSON.stringify({
            businessName: input.businessName.trim(),
            businessType: input.businessType,
            country: input.country,
            baseCurrency: input.baseCurrency,
            secondaryCurrency: input.secondaryCurrency,
          })
        : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const fields: Record<string, string[]> = {};
    if (
      record(payload) &&
      record(payload.error) &&
      record(payload.error.fieldErrors)
    ) {
      for (const [key, values] of Object.entries(payload.error.fieldErrors)) {
        if (
          Array.isArray(values) &&
          values.every((value) => typeof value === "string")
        )
          fields[key] = values;
      }
    }
    throw new SettingsError(response.status, fields);
  }
  let context: WorkspaceContext | null;
  try {
    context = parseWorkspaceContext(payload);
  } catch {
    throw new SettingsError(502);
  }
  if (!context || context.workspace.id !== workspaceId)
    throw new SettingsError(502);
  return context;
}

export const getBusinessSettings = (
  workspaceId: string,
  signal?: AbortSignal,
): Promise<WorkspaceContext> => request(workspaceId, undefined, signal);
export const updateBusinessSettings = (
  workspaceId: string,
  input: BusinessSettingsInput,
): Promise<WorkspaceContext> => request(workspaceId, input);
