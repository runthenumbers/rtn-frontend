import type { AppRoute } from "@/types/navigation";

export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  materials: "/materials",
  newMaterial: "/materials/new",
  editMaterial: "/materials/[materialId]/edit",
  batches: "/batches",
  newBatch: "/batches/new",
  batch: "/batches/[batchId]",
  settings: "/settings",
} as const satisfies Record<string, AppRoute>;
