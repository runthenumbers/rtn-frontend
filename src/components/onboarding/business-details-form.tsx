"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { FormError } from "@/components/auth/form-error";
import { CurrencySelect } from "@/components/onboarding/currency-select";
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
import { saveBusinessDetails } from "@/lib/onboarding/mock-onboarding";
import { routes } from "@/lib/routes";
import { useCatalogues } from "@/components/catalogues/catalogues-provider";

interface BusinessDetailsErrors {
  baseCurrency?: string;
  businessName?: string;
  businessType?: string;
  country?: string;
  secondaryCurrency?: string;
}

export function BusinessDetailsForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [country, setCountry] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [secondaryCurrency, setSecondaryCurrency] = useState("");
  const [errors, setErrors] = useState<BusinessDetailsErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currencies } = useCatalogues();

  function isAvailableCurrency(value: string): value is CurrencyCode {
    return (
      isCurrencyCode(value) &&
      currencies.some((currency) => currency.code === value)
    );
  }

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);

    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  function markChanged() {
    setIsDirty(true);
    setFormError(undefined);
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

    const nextErrors: BusinessDetailsErrors = {};

    if (businessName.trim().length < 2) {
      nextErrors.businessName = "Enter your business name.";
    }

    if (businessType && !isBusinessType(businessType)) {
      nextErrors.businessType = "Choose a supported business type.";
    }

    if (country && !isCountryCode(country)) {
      nextErrors.country = "Choose a supported country or region.";
    }

    if (!isAvailableCurrency(baseCurrency)) {
      nextErrors.baseCurrency = "Choose your base currency.";
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

    if (!isAvailableCurrency(baseCurrency)) {
      return;
    }

    const validBusinessType = isBusinessType(businessType)
      ? businessType
      : undefined;
    const validCountry = isCountryCode(country) ? country : undefined;
    const validSecondaryCurrency = isAvailableCurrency(secondaryCurrency)
      ? secondaryCurrency
      : undefined;

    setIsSubmitting(true);

    try {
      await saveBusinessDetails({
        baseCurrency,
        businessName: businessName.trim(),
        businessType: validBusinessType,
        country: validCountry,
        secondaryCurrency: validSecondaryCurrency,
      });
      setIsDirty(false);
      router.push(routes.dashboard);
    } catch {
      setFormError("We couldn't save your business details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="mt-9 grid gap-6"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      {formError ? <FormError>{formError}</FormError> : null}

      <TextField
        autoComplete="organization"
        error={errors.businessName}
        label="Business name"
        name="businessName"
        placeholder="Your business name"
        required
        value={businessName}
        onBlur={() => {
          if (businessName && businessName.trim().length < 2) {
            setErrors((current) => ({
              ...current,
              businessName: "Enter your business name.",
            }));
          }
        }}
        onChange={(event) => {
          setBusinessName(event.target.value);
          markChanged();
          if (errors.businessName) {
            setErrors((current) => ({
              ...current,
              businessName: undefined,
            }));
          }
        }}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
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
          <option value="">Select a business type</option>
          {businessTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          autoComplete="country"
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
          <option value="">Select a country or region</option>
          {countries.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-950">
          Currency preferences
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your base currency is the default for costs and totals. You can add a
          secondary currency for purchasing or comparison.
        </p>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <CurrencySelect
            description="Used for your primary cost reporting."
            error={errors.baseCurrency}
            label="Base currency"
            name="baseCurrency"
            value={baseCurrency}
            onBlur={() => {
              if (!baseCurrency) {
                setErrors((current) => ({
                  ...current,
                  baseCurrency: "Choose your base currency.",
                }));
              }
            }}
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
            description="Useful when suppliers charge in another currency."
            error={errors.secondaryCurrency}
            label="Secondary currency (optional)"
            name="secondaryCurrency"
            optional
            value={secondaryCurrency}
            onBlur={() => {
              if (secondaryCurrency === baseCurrency && secondaryCurrency) {
                setErrors((current) => ({
                  ...current,
                  secondaryCurrency:
                    "Choose a currency different from your base currency.",
                }));
              }
            }}
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
      </div>

      <FormActions>
        <button
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-950 px-6 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating workspace…" : "Create workspace"}
        </button>
      </FormActions>
    </form>
  );
}
