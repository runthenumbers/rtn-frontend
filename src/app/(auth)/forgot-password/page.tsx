import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request password-reset instructions for your RTN account.",
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="text-sm font-bold tracking-[0.14em] text-emerald-800 uppercase">
        Account recovery
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
        Reset your password
      </h1>
      <p className="mt-4 leading-7 text-slate-600">
        Get help accessing your RTN account.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        Remember your password?{" "}
        <Link
          className="font-semibold text-emerald-800 hover:text-emerald-950 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          href={routes.signIn}
        >
          Return to sign in
        </Link>
      </p>
    </div>
  );
}
