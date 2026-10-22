"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { resendVerification } from "@/lib/auth/api";
import { isValidEmail } from "@/lib/auth/validation";
import { TextField } from "@/components/ui/form-controls";
import { FormError } from "./form-error";

export function VerificationNotice({
  initialEmail = "",
  deliveryFailed = false,
}: {
  initialEmail?: string;
  deliveryFailed?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await resendVerification(email);
      setMessage(
        "If this account needs verification, a verification email has been requested. Check your inbox and spam folder.",
      );
    } catch {
      setError("We couldn’t request a verification email. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-5" aria-label="Email verification">
      <p className="leading-7 text-slate-700">
        {deliveryFailed
          ? "Your account may have been created, but we couldn’t send the verification email. Request another email below."
          : "Check your inbox and spam folder for a verification link. Verify your email before signing in."}
      </p>
      <form className="grid gap-4" onSubmit={resend}>
        {error ? <FormError>{error}</FormError> : null}
        {message ? (
          <p role="status" className="text-sm text-emerald-800">
            {message}
          </p>
        ) : null}
        <TextField
          label="Email address"
          name="verificationEmail"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-lg bg-emerald-950 px-5 font-semibold text-white disabled:opacity-70"
        >
          {busy ? "Requesting email…" : "Resend verification email"}
        </button>
      </form>
      <Link
        href="/sign-in"
        className="font-semibold text-emerald-800 underline"
      >
        Return to sign in
      </Link>
    </section>
  );
}
