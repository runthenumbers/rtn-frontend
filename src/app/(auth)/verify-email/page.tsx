import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
export const metadata: Metadata = {
  title: "Verify your email",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function VerifyEmailPage() {
  return (
    <div>
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-950">
        Verify your email
      </h1>
      <VerifyEmailForm />
    </div>
  );
}
