import { requireSession } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { AppRouteGate } from "@/components/auth/route-gates";
import type { ReactNode } from "react";
import { CataloguesProvider } from "@/components/catalogues/catalogues-provider";

import { MaterialsProvider } from "@/components/materials/materials-provider";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();
  return (
    <AppRouteGate>
      <AppShell>
        <CataloguesProvider>
          <MaterialsProvider>{children}</MaterialsProvider>
        </CataloguesProvider>
      </AppShell>
    </AppRouteGate>
  );
}
