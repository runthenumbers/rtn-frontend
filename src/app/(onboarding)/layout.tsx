import type { ReactNode } from "react";

import { OnboardingRouteGate } from "@/components/auth/mock-route-gates";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { CataloguesProvider } from "@/components/catalogues/catalogues-provider";

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <OnboardingRouteGate>
      <OnboardingShell>
        <CataloguesProvider>{children}</CataloguesProvider>
      </OnboardingShell>
    </OnboardingRouteGate>
  );
}
