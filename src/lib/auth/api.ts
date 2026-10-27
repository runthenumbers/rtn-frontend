export interface WorkspaceContext {
  workspace: {
    id: string;
    businessName: string;
    businessType: string | null;
    country: string | null;
    baseCurrency: string;
    secondaryCurrency: string | null;
  };
  membership: {
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
  };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  workspaceContext: WorkspaceContext | null;
}

export type AuthErrorCode =
  | "EMAIL_IN_USE"
  | "INVALID_CREDENTIALS"
  | "EMAIL_UNVERIFIED"
  | "VALIDATION"
  | "DELIVERY_FAILED"
  | "UNEXPECTED";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly fieldErrors: Record<string, string[]>;
  constructor(code: AuthErrorCode, fieldErrors: Record<string, string[]> = {}) {
    super(code);
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.name = "AuthError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWorkspaceContext(value: unknown): WorkspaceContext | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new AuthError("UNEXPECTED");

  const { workspace, membership } = value;
  if (
    !isRecord(workspace) ||
    !isRecord(membership) ||
    typeof workspace.id !== "string" ||
    typeof workspace.businessName !== "string" ||
    !(
      workspace.businessType === null ||
      typeof workspace.businessType === "string"
    ) ||
    !(workspace.country === null || typeof workspace.country === "string") ||
    typeof workspace.baseCurrency !== "string" ||
    !(
      workspace.secondaryCurrency === null ||
      typeof workspace.secondaryCurrency === "string"
    ) ||
    typeof membership.id !== "string" ||
    !(
      membership.role === "OWNER" ||
      membership.role === "ADMIN" ||
      membership.role === "MEMBER"
    )
  ) {
    throw new AuthError("UNEXPECTED");
  }

  return {
    workspace: {
      id: workspace.id,
      businessName: workspace.businessName,
      businessType: workspace.businessType,
      country: workspace.country,
      baseCurrency: workspace.baseCurrency,
      secondaryCurrency: workspace.secondaryCurrency,
    },
    membership: { id: membership.id, role: membership.role },
  };
}

async function request(path: string, body?: unknown): Promise<Response> {
  return fetch(`/api/v1/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

async function failure(response: Response, action: string): Promise<never> {
  const payload: unknown = await response.json().catch(() => null);
  const fieldErrors: Record<string, string[]> = {};
  if (
    isRecord(payload) &&
    isRecord(payload.error) &&
    isRecord(payload.error.fieldErrors)
  ) {
    for (const [key, value] of Object.entries(payload.error.fieldErrors)) {
      if (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      )
        fieldErrors[key] = value;
    }
  }
  const code: AuthErrorCode =
    response.status === 400
      ? "VALIDATION"
      : action === "register" && response.status === 409
        ? "EMAIL_IN_USE"
        : action === "sign-in" && response.status === 401
          ? "INVALID_CREDENTIALS"
          : action === "sign-in" &&
              response.status === 403 &&
              isRecord(payload) &&
              isRecord(payload.error) &&
              payload.error.message ===
                "Verify your email address before signing in."
            ? "EMAIL_UNVERIFIED"
            : action === "register" && response.status === 503
              ? "DELIVERY_FAILED"
              : "UNEXPECTED";
  throw new AuthError(code, fieldErrors);
}

export async function getSession(): Promise<SessionUser | null> {
  const response = await request("me");
  if (response.status === 401) return null;
  if (!response.ok) return failure(response, "me");
  const user: unknown = await response.json();
  if (
    !isRecord(user) ||
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.name !== "string"
  )
    throw new AuthError("UNEXPECTED");
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    workspaceContext: parseWorkspaceContext(user.workspaceContext),
  };
}

async function submit(action: string, input: unknown): Promise<void> {
  const response = await request(action, input);
  if (!response.ok) await failure(response, action);
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<void> {
  await submit("sign-in", {
    ...input,
    email: input.email.trim().toLowerCase(),
  });
}
export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  await submit("register", {
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
  });
}
export async function signOut(): Promise<void> {
  await submit("sign-out", {});
}
export async function verifyEmail(token: string): Promise<void> {
  await submit("verify-email", { token });
}
export async function resendVerification(email: string): Promise<void> {
  await submit("resend-verification", { email: email.trim().toLowerCase() });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await submit("forgot-password", { email: email.trim().toLowerCase() });
}
export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  await submit("reset-password", { token, password });
}
