"use client";

import { useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/auth/form-error";
import { PasswordField } from "@/components/auth/password-field";
import { TextField } from "@/components/ui/form-controls";
import { AuthError, signUp } from "@/lib/auth/api";
import { isValidEmail, passwordMeetsRequirements } from "@/lib/auth/validation";
import { VerificationNotice } from "./verification-notice";

interface SignUpErrors {
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
}

export function SignUpForm() {
  const [registered, setRegistered] = useState(false);
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<SignUpErrors>({});
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

    const nextErrors: SignUpErrors = {};

    if (name.trim().length < 1 || name.trim().length > 120) {
      nextErrors.name = "Enter your full name.";
    }

    if (!email.trim()) {
      nextErrors.email = "Enter your email address.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!passwordMeetsRequirements(password)) {
      nextErrors.password = "Use between 6 and 128 characters.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "The passwords do not match.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField();
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp({ name: name.trim(), email, password });
      setRegistered(true);
    } catch (error) {
      if (error instanceof AuthError && error.code === "DELIVERY_FAILED") {
        setDeliveryFailed(true);
        setRegistered(true);
      } else if (error instanceof AuthError && error.code === "VALIDATION") {
        setErrors({
          name: error.fieldErrors.name?.[0],
          email: error.fieldErrors.email?.[0],
          password: error.fieldErrors.password?.[0],
        });
        setFormError("Check the highlighted fields and try again.");
      } else if (error instanceof AuthError && error.code === "EMAIL_IN_USE") {
        setFormError(
          "An account already uses this email. Sign in or request another verification email.",
        );
      } else {
        setFormError("We couldn't create your account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (registered)
    return (
      <VerificationNotice
        initialEmail={email}
        deliveryFailed={deliveryFailed}
      />
    );

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      {formError ? <FormError>{formError}</FormError> : null}

      <TextField
        autoComplete="name"
        error={errors.name}
        label="Full name"
        name="name"
        placeholder="Your name"
        required
        value={name}
        onBlur={() => {
          if ((name && name.trim().length < 1) || name.trim().length > 120) {
            setErrors((current) => ({
              ...current,
              name: "Enter your full name.",
            }));
          }
        }}
        onChange={(event) => {
          setName(event.target.value);
          if (errors.name) {
            setErrors((current) => ({ ...current, name: undefined }));
          }
        }}
      />

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

      <PasswordField
        autoComplete="new-password"
        description="Between 6 and 128 characters."
        error={errors.password}
        label="Password"
        name="password"
        required
        value={password}
        onBlur={() => {
          if (password && !passwordMeetsRequirements(password)) {
            setErrors((current) => ({
              ...current,
              password: "Use between 6 and 128 characters.",
            }));
          }
        }}
        onChange={(event) => {
          setPassword(event.target.value);
          if (errors.password) {
            setErrors((current) => ({ ...current, password: undefined }));
          }
        }}
      />

      <PasswordField
        autoComplete="new-password"
        error={errors.confirmPassword}
        label="Confirm password"
        name="confirmPassword"
        required
        value={confirmPassword}
        onBlur={() => {
          if (confirmPassword && confirmPassword !== password) {
            setErrors((current) => ({
              ...current,
              confirmPassword: "The passwords do not match.",
            }));
          }
        }}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          if (errors.confirmPassword) {
            setErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }));
          }
        }}
      />

      <p className="text-sm leading-6 text-slate-600">
        By creating an account, you agree to use RTN responsibly and acknowledge
        our account policies.
      </p>

      <button
        className="mt-1 inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-950 px-5 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
