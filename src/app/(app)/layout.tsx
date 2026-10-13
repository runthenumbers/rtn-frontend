import { AppShell } from "@/components/layout/app-shell";
import { AppRouteGate } from "@/components/auth/mock-route-gates";
import type { ReactNode } from "react";
import { CataloguesProvider } from "@/components/catalogues/catalogues-provider";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AppRouteGate>
      <AppShell>
        <CataloguesProvider>{children}</CataloguesProvider>
      </AppShell>
    </AppRouteGate>
  );
}
