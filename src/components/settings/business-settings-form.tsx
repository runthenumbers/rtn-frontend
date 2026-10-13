"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

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
import {
  getMockWorkspaceServerSnapshot,
  getMockWorkspaceSnapshot,
  subscribeToMockWorkspace,
  type MockWorkspace,
} from "@/lib/onboarding/mock-workspace";
import { saveMockBusinessSettings } from "@/lib/settings/mock-settings";

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
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const workspace = useSyncExternalStore(
    subscribeToMockWorkspace,
    getMockWorkspaceSnapshot,
    getMockWorkspaceServerSnapshot,
  );

  if (!workspace) {
    if (!isHydrated) {
      return <LoadingState label="Loading business settings" />;
    }

    return (
      <ErrorState
        title="Business profile unavailable"
        description="We couldn't load the active business profile for this preview session. Sign out and sign in again to restore the sample workspace."
      />
    );
  }

  return <SettingsFields initialWorkspace={workspace} />;
}

function SettingsFields({
  initialWorkspace,
}: {
  initialWorkspace: MockWorkspace;
}) {
  const formRef = useRef<HTMLFormElement>(null);
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
    setFormError(undefined);
    setIsSaved(false);
    const nextErrors: SettingsErrors = {};

    if (businessName.trim().length < 2) {
      nextErrors.businessName =
        "Enter a business name of at least 2 characters.";
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

    setIsSubmitting(true);
    try {
      const saved = await saveMockBusinessSettings({
        baseCurrency,
        businessName,
        businessType: isBusinessType(businessType) ? businessType : undefined,
        country: isCountryCode(country) ? country : undefined,
        secondaryCurrency: isAvailableCurrency(secondaryCurrency)
          ? secondaryCurrency
          : undefined,
      });
      setSavedWorkspace(saved);
      setBusinessName(saved.businessName);
      setIsDirty(false);
      setIsSaved(true);
      formRef.current?.focus({ preventScroll: true });
    } catch {
      setFormError(
        "We couldn't save your business settings. Please try again.",
      );
    } finally {
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
              setErrors((current) => ({ ...current, businessType: undefined }));
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
          The base currency controls how existing recorded values are displayed.
          Changing it does not convert or recalculate saved amounts.
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
    </form>
  );
}
