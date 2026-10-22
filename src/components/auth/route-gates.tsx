"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { LoadingState } from "@/components/ui/feedback";
import {
  getMockWorkspaceSnapshot,
  getMockWorkspaceServerSnapshot,
  subscribeToMockWorkspace,
} from "@/lib/onboarding/mock-workspace";
import { routes } from "@/lib/routes";

function RouteGate({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "guest" | "onboarding" | "app";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const recovery =
    pathname === routes.resetPassword || pathname === routes.forgotPassword;
  const { status, refresh } = useAuth();
  const workspace = useSyncExternalStore(
    subscribeToMockWorkspace,
    getMockWorkspaceSnapshot,
    getMockWorkspaceServerSnapshot,
  );
  let destination: string | null = null;
  if (status === "authenticated") {
    if (mode === "guest" && !recovery)
      destination = workspace ? routes.dashboard : routes.onboarding;
    if (mode === "app" && !workspace) destination = routes.onboarding;
    if (mode === "onboarding" && workspace) destination = routes.dashboard;
  } else if (status === "unauthenticated" && mode !== "guest")
    destination = routes.signIn;
  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);
  if (status === "error")
    return (
      <main className="grid min-h-screen place-content-center gap-4 p-6 text-center">
        <p role="alert">We couldn’t check your session. Please try again.</p>
        <button
          className="rounded-lg bg-emerald-950 px-5 py-3 text-white"
          onClick={() => void refresh().catch(() => undefined)}
        >
          Try again
        </button>
      </main>
    );
  if (status === "loading" || destination)
    return <LoadingState label="Checking your session" />;
  return children;
}
export function GuestRouteGate({ children }: { children: ReactNode }) {
  return <RouteGate mode="guest">{children}</RouteGate>;
}
export function AppRouteGate({ children }: { children: ReactNode }) {
  return <RouteGate mode="app">{children}</RouteGate>;
}
export function OnboardingRouteGate({ children }: { children: ReactNode }) {
  return <RouteGate mode="onboarding">{children}</RouteGate>;
}
