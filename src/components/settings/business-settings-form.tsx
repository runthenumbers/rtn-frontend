"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/auth/form-error";
import { CurrencySelect } from "@/components/onboarding/currency-select";
import {
  ErrorState,
  LoadingState,
  SuccessFeedback,
} from "@/components/ui/feedback";
import {
  FormActions,
  SelectField,
  TextField,
} from "@/components/ui/form-controls";
import {
  businessTypes,
  countries,
  isBusinessType,
  isCountryCode,
} from "@/lib/domain/business-options";
import { isCurrencyCode, type CurrencyCode } from "@/lib/domain/currencies";
import { useAuth, useWorkspace } from "@/components/auth/auth-provider";
import type { WorkspaceContext } from "@/lib/auth/api";
import {
  getBusinessSettings,
  updateBusinessSettings,
  SettingsError,
} from "@/lib/settings/api";

interface SettingsErrors {
  baseCurrency?: string;
  businessName?: string;
  businessType?: string;
  country?: string;
  secondaryCurrency?: string;
}

import { useCatalogues } from "@/components/catalogues/catalogues-provider";

const secondaryActionClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export function BusinessSettingsForm() {
  const workspace = useWorkspace();
  const { refresh, updateWorkspaceContext } = useAuth();
  const [context, setContext] = useState<WorkspaceContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const workspaceId = workspace?.id;

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    void getBusinessSettings(workspaceId, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setContext(value);
        updateWorkspaceContext(value);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (
          error instanceof SettingsError &&
          (error.status === 401 || error.status === 404)
        ) {
          void refresh().catch(() => undefined);
        }
        setFailed(true);
      });
    return () => controller.abort();
  }, [workspaceId, attempt, refresh, updateWorkspaceContext]);

  if (failed)
    return (
      <ErrorState
        title="Business profile unavailable"
        description="We couldn't load your saved settings. Please try again."
        action={
          <button
            className={secondaryActionClassName}
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        }
      />
    );
  if (!context || context.workspace.id !== workspaceId)
    return <LoadingState label="Loading business settings" />;
  return (
    <SettingsFields
      key={context.workspace.id}
      initialWorkspace={context.workspace}
    />
  );
}

function SettingsFields({
  initialWorkspace,
}: {
  initialWorkspace: WorkspaceContext["workspace"];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const { user, refresh, updateWorkspaceContext } = useAuth();
  const role = user?.workspaceContext?.membership.role;
  const canEdit = role === "OWNER" || role === "ADMIN";
  const [savedWorkspace, setSavedWorkspace] = useState(initialWorkspace);
  const [businessName, setBusinessName] = useState(
    initialWorkspace.businessName,
  );
  const [businessType, setBusinessType] = useState(
    initialWorkspace.businessType ?? "",
  );
  const [country, setCountry] = useState(initialWorkspace.country ?? "");
  const [baseCurrency, setBaseCurrency] = useState<string>(
    initialWorkspace.baseCurrency,
  );
  const [secondaryCurrency, setSecondaryCurrency] = useState(
    initialWorkspace.secondaryCurrency ?? "",
  );
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { currencies } = useCatalogues();

  function isAvailableCurrency(value: string): value is CurrencyCode {
    return (
      isCurrencyCode(value) &&
      currencies.some((currency) => currency.code === value)
    );
  }

  useEffect(() => {
    if (!isDirty) return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  function markChanged() {
    setIsDirty(true);
    setIsSaved(false);
    setFormError(undefined);
  }

  function resetFields() {
    setBusinessName(savedWorkspace.businessName);
    setBusinessType(savedWorkspace.businessType ?? "");
    setCountry(savedWorkspace.country ?? "");
    setBaseCurrency(savedWorkspace.baseCurrency);
    setSecondaryCurrency(savedWorkspace.secondaryCurrency ?? "");
    setErrors({});
    setFormError(undefined);
    setIsSaved(false);
    setIsDirty(false);
  }

  function discardChanges() {
    if (!isDirty || window.confirm("Discard your unsaved settings changes?")) {
      resetFields();
    }
  }

  function focusFirstInvalidField() {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || submittingRef.current) return;
    setFormError(undefined);
    setIsSaved(false);
    const nextErrors: SettingsErrors = {};

    if (businessName.trim().length < 2 || businessName.trim().length > 160) {
      nextErrors.businessName = "Enter a business name of 2–160 characters.";
    }
    if (businessType && !isBusinessType(businessType)) {
      nextErrors.businessType = "Choose a supported business type.";
    }
    if (country && !isCountryCode(country)) {
      nextErrors.country = "Choose a supported country or region.";
    }
    if (!isAvailableCurrency(baseCurrency)) {
      nextErrors.baseCurrency = "Choose a supported base currency.";
    }
    if (secondaryCurrency && !isAvailableCurrency(secondaryCurrency)) {
      nextErrors.secondaryCurrency = "Choose a supported secondary currency.";
    } else if (secondaryCurrency && secondaryCurrency === baseCurrency) {
      nextErrors.secondaryCurrency =
        "Choose a currency different from your base currency.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField();
      return;
    }
    if (!isAvailableCurrency(baseCurrency)) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const savedContext = await updateBusinessSettings(initialWorkspace.id, {
        baseCurrency,
        businessName,
        businessType: businessType || null,
        country: country || null,
        secondaryCurrency: isAvailableCurrency(secondaryCurrency)
          ? secondaryCurrency
          : null,
      });
      const saved = savedContext.workspace;
      updateWorkspaceContext(savedContext);
      setSavedWorkspace(saved);
      setBusinessName(saved.businessName);
      setIsDirty(false);
      setIsSaved(true);
      formRef.current?.focus({ preventScroll: true });
    } catch (error) {
      if (error instanceof SettingsError && error.status === 400) {
        setErrors({
          businessName: error.fieldErrors.businessName?.[0],
          businessType: error.fieldErrors.businessType?.[0],
          country: error.fieldErrors.country?.[0],
          baseCurrency: error.fieldErrors.baseCurrency?.[0],
          secondaryCurrency: error.fieldErrors.secondaryCurrency?.[0],
        });
        setFormError("Check the highlighted fields and try again.");
        focusFirstInvalidField();
      } else if (error instanceof SettingsError && error.status === 409) {
        setFormError(
          "The base currency cannot change after materials have been recorded. Keep the current base currency and try again.",
        );
      } else if (error instanceof SettingsError && error.status === 403) {
        setFormError("You no longer have permission to update these settings.");
        void refresh().catch(() => undefined);
      } else if (
        error instanceof SettingsError &&
        (error.status === 401 || error.status === 404)
      ) {
        setFormError(
          "Your workspace access has changed. Checking your session…",
        );
        void refresh().catch(() => undefined);
      } else {
        setFormError(
          "We couldn't confirm your settings were saved. Your changes are still here; please try again.",
        );
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
      tabIndex={-1}
    >
      {!canEdit ? (
        <p className="px-5 pt-5 text-sm text-slate-600 sm:px-7">
          Only workspace owners and administrators can change business settings.
        </p>
      ) : null}
      <fieldset disabled={!canEdit || isSubmitting}>
        <section
          className="p-5 sm:p-7"
          aria-labelledby="business-profile-heading"
        >
          <h2
            className="text-xl font-semibold text-slate-950"
            id="business-profile-heading"
          >
            Business profile
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Keep the active workspace name and operating details recognisable to
            your team.
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                autoComplete="organization"
                description="Shown throughout this workspace."
                error={errors.businessName}
                label="Business name"
                name="businessName"
                maxLength={160}
                required
                value={businessName}
                onChange={(event) => {
                  setBusinessName(event.target.value);
                  markChanged();
                  setErrors((current) => ({
                    ...current,
                    businessName: undefined,
                  }));
                }}
              />
            </div>
            <SelectField
              description="Helps describe the products this workspace costs."
              error={errors.businessType}
              label="Business type (optional)"
              name="businessType"
              value={businessType}
              onChange={(event) => {
                setBusinessType(event.target.value);
                markChanged();
                setErrors((current) => ({
                  ...current,
                  businessType: undefined,
                }));
              }}
            >
              <option value="">No business type selected</option>
              {businessTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              autoComplete="country"
              description="Used as business context; it does not calculate tax or compliance rules."
              error={errors.country}
              label="Country or region (optional)"
              name="country"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                markChanged();
                setErrors((current) => ({ ...current, country: undefined }));
              }}
            >
              <option value="">No country or region selected</option>
              {countries.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
        </section>

        <section
          className="border-t border-slate-200 p-5 sm:p-7"
          aria-labelledby="currency-settings-heading"
        >
          <h2
            className="text-xl font-semibold text-slate-950"
            id="currency-settings-heading"
          >
            Currency preferences
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Your base currency is the default for recording costs. It can change
            before materials are recorded; saved prices are never converted
            automatically.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <CurrencySelect
              description="Used for material prices, batch costs, and workspace summaries."
              error={errors.baseCurrency}
              label="Base currency"
              name="baseCurrency"
              value={baseCurrency}
              onChange={(value) => {
                setBaseCurrency(value);
                markChanged();
                setErrors((current) => ({
                  ...current,
                  baseCurrency: undefined,
                  secondaryCurrency:
                    value && value === secondaryCurrency
                      ? "Choose a currency different from your base currency."
                      : undefined,
                }));
              }}
            />
            <CurrencySelect
              description="Recorded for future purchasing comparisons; no exchange conversion is performed."
              error={errors.secondaryCurrency}
              label="Secondary currency (optional)"
              name="secondaryCurrency"
              optional
              value={secondaryCurrency}
              onChange={(value) => {
                setSecondaryCurrency(value);
                markChanged();
                setErrors((current) => ({
                  ...current,
                  secondaryCurrency:
                    value && value === baseCurrency
                      ? "Choose a currency different from your base currency."
                      : undefined,
                }));
              }}
            />
          </div>
        </section>

        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          {isSaved || formError ? (
            <div className="mb-6 grid gap-4">
              {isSaved ? (
                <SuccessFeedback>
                  Business profile and currency preferences are now up to date.
                </SuccessFeedback>
              ) : null}
              {formError ? <FormError>{formError}</FormError> : null}
            </div>
          ) : null}
          <FormActions>
            <button
              className={secondaryActionClassName}
              disabled={!isDirty || isSubmitting}
              onClick={discardChanges}
              type="button"
            >
              Discard changes
            </button>
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-950 px-6 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={!isDirty || isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving settings…" : "Save changes"}
            </button>
          </FormActions>
        </div>
      </fieldset>
    </form>
  );
}
