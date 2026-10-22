import { requireSession } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { AppRouteGate } from "@/components/auth/route-gates";
import type { ReactNode } from "react";
import { CataloguesProvider } from "@/components/catalogues/catalogues-provider";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSession();
  return (
    <AppRouteGate>
      <AppShell>
        <CataloguesProvider>{children}</CataloguesProvider>
      </AppShell>
    </AppRouteGate>
  );
}
