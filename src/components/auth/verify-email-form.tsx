"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthError, verifyEmail } from "@/lib/auth/api";
import { VerificationNotice } from "./verification-notice";
import { FormError } from "./form-error";

export function VerifyEmailForm() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
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
  async function confirm() {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyEmail(token);
      setToken(null);
      setComplete(true);
    } catch (failure) {
      setError(
        failure instanceof AuthError && failure.code === "VALIDATION"
          ? "This link is invalid, expired or already used. Request another email below."
          : "We couldn’t verify your email. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p role="status">Preparing verification…</p>;
  if (complete)
    return (
      <div className="grid gap-5">
        <p role="status">Your email is verified. You can now sign in.</p>
        <Link
          className="font-semibold text-emerald-800 underline"
          href="/sign-in"
        >
          Sign in
        </Link>
      </div>
    );
  return (
    <div className="grid gap-6">
      {error ? <FormError>{error}</FormError> : null}
      {token ? (
        <>
          <p>Confirm below to verify your email address.</p>
          <button
            onClick={confirm}
            disabled={busy}
            className="min-h-12 rounded-lg bg-emerald-950 px-5 font-semibold text-white disabled:opacity-70"
          >
            {busy ? "Verifying…" : "Verify email"}
          </button>
        </>
      ) : (
        <p>
          This page needs the link from your verification email. You can also
          request a new link below.
        </p>
      )}
      <VerificationNotice />
    </div>
  );
}
