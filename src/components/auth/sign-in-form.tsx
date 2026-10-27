"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/auth/form-error";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/ui/form-controls";
import { AuthError, signIn } from "@/lib/auth/api";
import { isValidEmail } from "@/lib/auth/validation";
import { routes } from "@/lib/routes";
import { useAuth } from "./auth-provider";
import { VerificationNotice } from "./verification-notice";

interface SignInErrors {
  email?: string;
  password?: string;
}

export function SignInForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [needsVerification, setNeedsVerification] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignInErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  function focusFirstInvalidField() {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setNeedsVerification(false);

    const nextErrors: SignInErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Enter your email address.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField();
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn({ email, password });
      const user = await refresh();
      if (!user) throw new AuthError("UNEXPECTED");
      router.replace(
        user.workspaceContext ? routes.dashboard : routes.onboarding,
      );
      router.refresh();
    } catch (error) {
      if (error instanceof AuthError && error.code === "INVALID_CREDENTIALS") {
        setFormError(
          "The email or password is incorrect. Check both and try again.",
        );
      } else if (
        error instanceof AuthError &&
        error.code === "EMAIL_UNVERIFIED"
      ) {
        setNeedsVerification(true);
        setFormError("Verify your email before signing in.");
      } else if (error instanceof AuthError && error.code === "VALIDATION") {
        setErrors({
          email: error.fieldErrors.email?.[0],
          password: error.fieldErrors.password?.[0],
        });
        setFormError("Check the highlighted fields and try again.");
      } else {
        setFormError("We couldn't sign you in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form
        className="grid gap-5"
        noValidate
        onSubmit={handleSubmit}
        ref={formRef}
      >
        {formError ? <FormError>{formError}</FormError> : null}

        <TextField
          autoComplete="email"
          error={errors.email}
          inputMode="email"
          label="Email address"
          name="email"
          placeholder="you@business.com"
          required
          type="email"
          value={email}
          onBlur={() => {
            if (email && !isValidEmail(email)) {
              setErrors((current) => ({
                ...current,
                email: "Enter a valid email address.",
              }));
            }
          }}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) {
              setErrors((current) => ({ ...current, email: undefined }));
            }
          }}
        />

        <div>
          <PasswordField
            autoComplete="current-password"
            error={errors.password}
            label="Password"
            name="password"
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) {
                setErrors((current) => ({ ...current, password: undefined }));
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <Link
              className="text-sm font-semibold text-emerald-800 hover:text-emerald-950 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              href={routes.forgotPassword}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-950 px-5 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-sm">
        <Link
          href={routes.verifyEmail}
          className="font-semibold text-emerald-800 underline"
        >
          Need another verification email?
        </Link>
      </p>
      {needsVerification ? (
        <div className="mt-6">
          <VerificationNotice initialEmail={email} />
        </div>
      ) : null}
    </>
  );
}
