"use client";

import { useState, type FormEvent } from "react";
import { AuthError, requestPasswordReset } from "@/lib/auth/api";
import { isValidEmail } from "@/lib/auth/validation";
import { TextField } from "@/components/ui/form-controls";
import { FormError } from "./form-error";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEmailError("");
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setComplete(true);
    } catch (failure) {
      if (failure instanceof AuthError && failure.code === "VALIDATION")
        setEmailError(
          failure.fieldErrors.email?.[0] ?? "Enter a valid email address.",
        );
      else
        setError(
          "We couldn’t request password reset instructions. Please try again.",
        );
    } finally {
      setBusy(false);
    }
  }
  if (complete)
    return (
      <section className="grid gap-4" role="status">
        <h2 className="text-xl font-semibold">Check your inbox</h2>
        <p className="leading-7">
          If an account matches this email, password reset instructions have
          been requested. Check your inbox and spam folder. The link expires in
          30 minutes.
        </p>
        <button
          className="text-left font-semibold text-emerald-800 underline"
          onClick={() => setComplete(false)}
        >
          Request another link
        </button>
      </section>
    );
  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error ? <FormError>{error}</FormError> : null}
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        value={email}
        error={emailError}
        onChange={(event) => {
          setEmail(event.target.value);
          setEmailError("");
        }}
      />
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 rounded-lg bg-emerald-950 px-5 font-semibold text-white disabled:opacity-70"
      >
        {busy ? "Requesting instructions…" : "Send reset instructions"}
      </button>
    </form>
  );
}
