import type { ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { GuestRouteGate } from "@/components/auth/route-gates";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <GuestRouteGate>
      <AuthShell>{children}</AuthShell>
    </GuestRouteGate>
  );
}
