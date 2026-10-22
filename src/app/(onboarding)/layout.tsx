import { requireSession } from "@/lib/auth/server";
import type { ReactNode } from "react";

import { OnboardingRouteGate } from "@/components/auth/route-gates";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { CataloguesProvider } from "@/components/catalogues/catalogues-provider";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();
  return (
    <OnboardingRouteGate>
      <OnboardingShell>
        <CataloguesProvider>{children}</CataloguesProvider>
      </OnboardingShell>
    </OnboardingRouteGate>
  );
}
