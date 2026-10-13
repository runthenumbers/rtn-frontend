"use client";

import { SelectField } from "@/components/ui/form-controls";
import { useCatalogues } from "@/components/catalogues/catalogues-provider";

interface CurrencySelectProps {
  description: string;
  error?: string;
  label: string;
  name: string;
  optional?: boolean;
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
}

export function CurrencySelect({
  description,
  error,
  label,
  name,
  onBlur,
  onChange,
  optional = false,
  value,
}: CurrencySelectProps) {
  const { currencies } = useCatalogues();
  const unsupported = Boolean(
    value && !currencies.some((currency) => currency.code === value),
  );

  return (
    <SelectField
      description={description}
      error={
        unsupported
          ? "This currency is no longer supported. Choose another currency."
          : error
      }
      label={label}
      name={name}
      required={!optional}
      value={value}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">
        {optional ? "No secondary currency" : "Select a currency"}
      </option>
      {unsupported ? (
        <option value={value} disabled>
          {value} — no longer supported
        </option>
      ) : null}
      {currencies.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.name} ({currency.symbol} · {currency.code})
        </option>
      ))}
    </SelectField>
  );
}
