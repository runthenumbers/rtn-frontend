import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your RTN production-costing workspace.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const resetSuccess = (await searchParams).reset === "success";
  return (
    <div>
      <p className="text-sm font-bold tracking-[0.14em] text-emerald-800 uppercase">
        Welcome back
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
        Sign in to RTN
      </h1>
      <p className="mt-4 leading-7 text-slate-600">
        Continue to your materials, batches, and production costs.
      </p>

      {resetSuccess ? (
        <p
          role="status"
          className="mt-6 rounded-lg bg-emerald-50 p-4 text-emerald-900"
        >
          Your password has been reset. Sign in with your new password.
        </p>
      ) : null}
      <div className="mt-8">
        <SignInForm />
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        New to RTN?{" "}
        <Link
          className="font-semibold text-emerald-800 hover:text-emerald-950 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          href={routes.signUp}
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
