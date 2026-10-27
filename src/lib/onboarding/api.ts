import type { SessionUser } from "../auth/api.ts";

export interface BusinessDetailsInput {
  businessName: string;
  businessType?: string;
  country?: string;
  baseCurrency: string;
  secondaryCurrency?: string;
}

export type WorkspaceErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "ALREADY_EXISTS"
  | "UNEXPECTED";

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode;
  readonly fieldErrors: Record<string, string[]>;
  constructor(
    code: WorkspaceErrorCode,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(code);
    this.name = "WorkspaceError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export async function createWorkspace(
  input: BusinessDetailsInput,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/v1/workspaces", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: input.businessName.trim(),
        businessType: input.businessType,
        country: input.country,
        baseCurrency: input.baseCurrency,
        secondaryCurrency: input.secondaryCurrency,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WorkspaceError("UNEXPECTED");
  }
  if (response.status === 201) return;

  const payload: unknown = await response.json().catch(() => null);
  const fieldErrors: Record<string, string[]> = {};
  if (
    isRecord(payload) &&
    isRecord(payload.error) &&
    isRecord(payload.error.fieldErrors)
  ) {
    for (const [field, messages] of Object.entries(payload.error.fieldErrors)) {
      if (
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string")
      ) {
        fieldErrors[field] = messages;
      }
    }
  }
  const code: WorkspaceErrorCode =
    response.status === 400
      ? "VALIDATION"
      : response.status === 401
        ? "UNAUTHENTICATED"
        : response.status === 403
          ? "FORBIDDEN"
          : response.status === 409
            ? "ALREADY_EXISTS"
            : "UNEXPECTED";
  throw new WorkspaceError(code, fieldErrors);
}

export async function completeOnboarding(
  input: BusinessDetailsInput,
  refresh: () => Promise<SessionUser | null>,
): Promise<void> {
  let creationError: WorkspaceError | undefined;
  try {
    await createWorkspace(input);
  } catch (error) {
    if (
      !(error instanceof WorkspaceError) ||
      !["ALREADY_EXISTS", "UNEXPECTED", "UNAUTHENTICATED"].includes(error.code)
    )
      throw error;
    creationError = error;
  }
  // Reconcile conflicts and lost responses with authoritative state before retrying POST.
  const user = await refresh();
  if (!user) throw new WorkspaceError("UNAUTHENTICATED");
  if (user.workspaceContext) return;
  throw creationError ?? new WorkspaceError("UNEXPECTED");
}
