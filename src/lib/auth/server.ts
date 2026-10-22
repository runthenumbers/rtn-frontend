import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireSession(): Promise<void> {
  const store = await cookies();
  const name =
    process.env.NODE_ENV === "production"
      ? "__Host-rtn-session"
      : "rtn-session";
  const token = store.get(name)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) redirect("/sign-in");
  const backend = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001"
  ).replace(/\/+$/, "");
  const response = await fetch(`${backend}/v1/auth/me`, {
    headers: { Cookie: `${name}=${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) redirect("/sign-in");
  if (!response.ok)
    throw new Error("Unable to check your session. Please try again.");
}
