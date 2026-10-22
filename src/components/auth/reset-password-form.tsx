"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthError, resetPassword } from "@/lib/auth/api";
import { passwordMeetsRequirements } from "@/lib/auth/validation";
import { PasswordField } from "./password-field";
import { FormError } from "./form-error";

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
      if (value && /^[A-Za-z0-9_-]{43}$/.test(value)) setToken(value);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPasswordError("");
    setConfirmationError("");
    if (!token) return;
    const valid = passwordMeetsRequirements(password);
    const matches = password === confirmation;
    if (!valid) setPasswordError("Use between 6 and 128 characters.");
    if (!matches) setConfirmationError("The passwords do not match.");
    if (!valid || !matches) return;
    setBusy(true);
    try {
      await resetPassword(token, password);
      setToken(null);
      setPassword("");
      setConfirmation("");
      // Reload to discard the previous account context and cached protected UI.
      window.location.replace("/sign-in?reset=success");
    } catch (failure) {
      if (failure instanceof AuthError && failure.code === "VALIDATION") {
        if (failure.fieldErrors.password?.[0])
          setPasswordError(failure.fieldErrors.password[0]);
        else {
          setToken(null);
          setError(
            "This reset link is invalid, expired or already used. Request a new link.",
          );
        }
      } else setError("We couldn’t reset your password. Please try again.");
      setBusy(false);
    }
  }
  if (!ready) return <p role="status">Preparing password reset…</p>;
  return (
    <div className="grid gap-5">
      {error ? <FormError>{error}</FormError> : null}
      {token ? (
        <form onSubmit={submit} noValidate className="grid gap-5">
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            description="Between 6 and 128 characters."
            required
            value={password}
            error={passwordError}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError("");
            }}
          />
          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmation}
            error={confirmationError}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setConfirmationError("");
            }}
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-lg bg-emerald-950 px-5 font-semibold text-white disabled:opacity-70"
          >
            {busy ? "Resetting password…" : "Reset password"}
          </button>
        </form>
      ) : (
        <p>
          Open the link from your most recent reset email to choose a new
          password.
        </p>
      )}
      <Link
        href="/forgot-password"
        className="font-semibold text-emerald-800 underline"
      >
        Request a new reset link
      </Link>
    </div>
  );
}
