import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
export const metadata: Metadata = {
  title: "Choose a new password",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-950">
        Choose a new password
      </h1>
      <ResetPasswordForm />
    </div>
  );
}
