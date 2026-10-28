"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useCatalogues } from "@/components/catalogues/catalogues-provider";
import { FormError } from "@/components/auth/form-error";
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
import { useAuth } from "@/components/auth/auth-provider";
import { isMaterialUnit, type MaterialUnit } from "@/lib/domain/material-units";
import {
  deriveStockStatus,
  materialCategories,
  type MaterialCategory,
  type MaterialInput,
  type MaterialSummary,
} from "@/lib/materials/types";
import { validDecimal } from "@/lib/materials/types";
import { getMaterial, saveMaterial, MaterialError } from "@/lib/materials/api";
import { useMaterials } from "./materials-provider";
import { useWorkspace } from "@/components/auth/auth-provider";
import { routes } from "@/lib/routes";

interface MaterialFormProps {
  materialId?: string;
}

interface MaterialFormErrors {
  category?: string;
  name?: string;
  packQuantity?: string;
  purchasePrice?: string;
  stockQuantity?: string;
  supplier?: string;
  unit?: string;
}

const secondaryActionClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:w-auto";

export function MaterialForm({ materialId }: MaterialFormProps) {
  const { user: session, refresh } = useAuth();
  const workspace = useWorkspace();
  const [detail, setDetail] = useState<MaterialSummary | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const workspaceId = workspace?.id;
  useEffect(() => {
    if (!workspaceId || !materialId) return;
    const controller = new AbortController();
    void getMaterial(workspaceId, materialId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setDetail(value);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(failure);
        if (failure instanceof MaterialError && failure.status === 401)
          void refresh().catch(() => undefined);
      });
    return () => controller.abort();
  }, [workspaceId, materialId, attempt, refresh]);
  if (error)
    return (
      <ErrorState
        title={
          error instanceof MaterialError && error.status === 404
            ? "Material not found"
            : "Unable to load material"
        }
        description="The material may be unavailable, or the request failed. Return to the catalogue or try again."
        action={
          <div className="flex flex-wrap gap-3">
            <Link className={secondaryActionClassName} href={routes.materials}>
              Back to materials
            </Link>
            <button
              className={secondaryActionClassName}
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        }
      />
    );
  if (
    !session ||
    !workspace ||
    (materialId &&
      (!detail ||
        detail.id !== materialId ||
        detail.workspaceId !== workspace.id))
  )
    return <LoadingState label="Loading material form" />;
  return (
    <MaterialFormFields
      key={`${workspace.id}:${materialId ?? "new"}`}
      initialMaterial={materialId ? (detail ?? undefined) : undefined}
      materialId={materialId}
    />
  );
}
interface MaterialFormFieldsProps extends MaterialFormProps {
  initialMaterial?: MaterialSummary;
}

function MaterialFormFields({
  initialMaterial,
  materialId,
}: MaterialFormFieldsProps) {
  const { units, currencies } = useCatalogues();
  const { user, refresh } = useAuth();
  const { saved } = useMaterials();
  const submittingRef = useRef(false);
  const role = user?.workspaceContext?.membership.role;
  const canEdit = role === "OWNER" || role === "ADMIN";
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const workspace = useWorkspace();
  const currency = currencies.find(
    (option) => option.code === workspace?.baseCurrency,
  );

  const [savedMaterialId, setSavedMaterialId] = useState<string>();
  const [name, setName] = useState(initialMaterial?.name ?? "");
  const [category, setCategory] = useState(initialMaterial?.category ?? "");
  const [supplier, setSupplier] = useState(initialMaterial?.supplier ?? "");
  const [purchasePrice, setPurchasePrice] = useState(
    initialMaterial ? String(initialMaterial.purchasePrice) : "",
  );
  const [packQuantity, setPackQuantity] = useState(
    initialMaterial ? String(initialMaterial.packQuantity) : "",
  );
  const [unit, setUnit] = useState(initialMaterial?.unit ?? "");
  const [stockQuantity, setStockQuantity] = useState(
    initialMaterial ? String(initialMaterial.stockQuantity) : "",
  );
  const [errors, setErrors] = useState<MaterialFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  function isAvailableUnit(value: string): value is MaterialUnit {
    return (
      isMaterialUnit(value) && units.some((option) => option.code === value)
    );
  }

  const unsupportedUnit = Boolean(unit && !isAvailableUnit(unit));

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

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
    setIsSaved(false);
    setFormError(undefined);
  }

  function clearError(field: keyof MaterialFormErrors) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function focusFirstInvalidField() {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    });
  }

  function leaveForm() {
    if (
      !isDirty ||
      window.confirm("Leave without saving your material changes?")
    ) {
      setIsDirty(false);
      router.push(routes.materials);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || submittingRef.current) return;
    setFormError(undefined);
    setIsSaved(false);
    if (!currency) {
      setFormError(
        "Choose a supported base currency in Settings before saving a material.",
      );
      return;
    }

    const nextErrors: MaterialFormErrors = {};
    if (name.trim().length < 2 || name.trim().length > 160)
      nextErrors.name = "Enter a material name of 2–160 characters.";
    if (!materialCategories.includes(category as MaterialCategory))
      nextErrors.category = "Choose a material category.";
    if (supplier.trim().length > 160)
      nextErrors.supplier = "Use at most 160 characters for the supplier.";
    if (!validDecimal(purchasePrice, true))
      nextErrors.purchasePrice =
        "Enter a positive price with up to 14 integer digits and 6 decimal places.";
    if (!validDecimal(packQuantity, true))
      nextErrors.packQuantity =
        "Enter a positive purchase quantity with up to 6 decimal places.";
    if (!validDecimal(stockQuantity))
      nextErrors.stockQuantity =
        "Enter zero or a positive stock quantity with up to 6 decimal places.";
    if (!isAvailableUnit(unit)) nextErrors.unit = "Choose a supported unit.";
    if (units.find((option) => option.code === unit)?.dimension === "COUNT") {
      if (/\.[0-9]*[1-9]/.test(packQuantity))
        nextErrors.packQuantity =
          "Count units require a whole purchase quantity.";
      if (/\.[0-9]*[1-9]/.test(stockQuantity))
        nextErrors.stockQuantity =
          "Count units require a whole stock quantity.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField();
      return;
    }

    if (
      !materialCategories.includes(category as MaterialCategory) ||
      !isAvailableUnit(unit)
    ) {
      return;
    }

    const input: MaterialInput = {
      category: category as MaterialCategory,
      name: name.trim(),
      packQuantity,
      purchasePrice,
      stockQuantity,
      supplier: supplier.trim(),
      unit,
      currencyCode: currency.code,
    };

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (!workspace) return;
      const savedMaterial = await saveMaterial(
        workspace.id,
        input,
        materialId ?? savedMaterialId,
      );
      saved(savedMaterial);
      setName(savedMaterial.name);
      setSupplier(savedMaterial.supplier);
      setPurchasePrice(savedMaterial.purchasePrice);
      setPackQuantity(savedMaterial.packQuantity);
      setStockQuantity(savedMaterial.stockQuantity);
      setSavedMaterialId(savedMaterial.id);
      setIsDirty(false);
      setIsSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (!materialId)
        router.replace(
          routes.editMaterial.replace("[materialId]", savedMaterial.id),
        );
    } catch (failure) {
      if (failure instanceof MaterialError && failure.status === 400) {
        const fields = failure.fieldErrors;
        setErrors({
          name: fields.name?.[0],
          supplier: fields.supplier?.[0],
          category: fields.category?.[0],
          unit: fields.unit?.[0],
          purchasePrice: fields.purchasePrice?.[0],
          packQuantity: fields.packQuantity?.[0],
          stockQuantity: fields.stockQuantity?.[0],
        });
        setFormError(
          fields.currencyCode?.[0] ??
            "Check the highlighted fields and try again.",
        );
        focusFirstInvalidField();
        if (fields.currencyCode) void refresh().catch(() => undefined);
      } else if (failure instanceof MaterialError && failure.status === 403) {
        setFormError("You no longer have permission to save materials.");
        void refresh().catch(() => undefined);
      } else if (failure instanceof MaterialError && failure.status === 401) {
        void refresh().catch(() => undefined);
        setFormError("Your session expired. Please sign in again.");
      } else if (failure instanceof MaterialError && failure.status === 404) {
        setFormError(
          "This material or workspace is no longer available. Return to the catalogue.",
        );
      } else {
        setFormError(
          "We couldn't confirm this material was saved. Check the catalogue before retrying to avoid creating a duplicate.",
        );
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const stockStatus =
    validDecimal(stockQuantity) && validDecimal(packQuantity, true)
      ? deriveStockStatus(stockQuantity, packQuantity)
      : undefined;

  if (!currency) {
    return (
      <ErrorState
        title="Choose a supported workspace currency"
        description="Update your base currency in Settings before creating or editing materials."
        action={
          <Link className={secondaryActionClassName} href={routes.settings}>
            Open settings
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        href={routes.materials}
        onClick={(event) => {
          if (
            isDirty &&
            !window.confirm("Leave without saving your material changes?")
          ) {
            event.preventDefault();
          }
        }}
      >
        ← Back to materials
      </Link>

      <header className="mt-4">
        <p className="text-sm font-bold tracking-[0.12em] text-emerald-800 uppercase">
          Materials
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
          {!canEdit
            ? "View material"
            : materialId
              ? "Edit material"
              : "Create material"}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          {materialId
            ? "Keep purchasing and stock details current for dependable batch costs."
            : "Record the purchasing and stock details needed for dependable batch costs."}
        </p>
      </header>

      <div className="mt-8 grid gap-5">
        {isSaved ? (
          <SuccessFeedback
            title={materialId ? "Material updated" : "Material created"}
          >
            {name.trim()} is saved and available in your material catalogue.
          </SuccessFeedback>
        ) : null}
        {formError ? <FormError>{formError}</FormError> : null}
      </div>

      <form
        className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        noValidate
        onSubmit={handleSubmit}
        ref={formRef}
      >
        {!canEdit ? (
          <p className="px-5 pt-5 text-sm text-slate-600">
            Only owners and administrators can create or update materials.
          </p>
        ) : null}
        <fieldset disabled={!canEdit || isSubmitting}>
          <section
            className="p-5 sm:p-7"
            aria-labelledby="material-details-heading"
          >
            <h2
              className="text-xl font-semibold tracking-tight text-slate-950"
              id="material-details-heading"
            >
              Material details
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the name and category your team will recognise when costing a
              batch.
            </p>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  autoComplete="off"
                  error={errors.name}
                  label="Material name"
                  name="name"
                  maxLength={160}
                  placeholder="e.g. Sweet almond oil"
                  inputRef={nameRef}
                  required
                  value={name}
                  onBlur={() => {
                    if (name && name.trim().length < 2) {
                      setErrors((current) => ({
                        ...current,
                        name: "Enter a material name of at least 2 characters.",
                      }));
                    }
                  }}
                  onChange={(event) => {
                    setName(event.target.value);
                    markChanged();
                    clearError("name");
                  }}
                />
              </div>
              <SelectField
                error={errors.category}
                label="Category"
                name="category"
                required
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  markChanged();
                  clearError("category");
                }}
              >
                <option value="">Select a category</option>
                {materialCategories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
              <TextField
                autoComplete="organization"
                error={errors.supplier}
                label="Supplier (optional)"
                name="supplier"
                maxLength={160}
                placeholder="e.g. The Soapery"
                value={supplier}
                onChange={(event) => {
                  setSupplier(event.target.value);
                  markChanged();
                  clearError("supplier");
                }}
              />
            </div>
          </section>

          <section
            className="border-t border-slate-200 p-5 sm:p-7"
            aria-labelledby="purchasing-heading"
          >
            <h2
              className="text-xl font-semibold tracking-tight text-slate-950"
              id="purchasing-heading"
            >
              Purchasing
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter the total price and quantity for one purchased pack. Prices
              use your workspace currency, {currency.code}.
            </p>

            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <TextField
                error={errors.purchasePrice}
                inputMode="decimal"
                label={`Purchase price (${currency.code})`}
                min="0"
                name="purchasePrice"
                placeholder="0.00"
                required
                step="0.000001"
                type="text"
                value={purchasePrice}
                endAdornment={
                  <span
                    className="px-3 text-sm font-semibold text-slate-500"
                    aria-hidden="true"
                  >
                    {currency.symbol}
                  </span>
                }
                onChange={(event) => {
                  setPurchasePrice(event.target.value);
                  markChanged();
                  clearError("purchasePrice");
                }}
              />
              <TextField
                description="Quantity included in one purchased pack."
                error={errors.packQuantity}
                inputMode="decimal"
                label="Purchase quantity"
                min="0"
                name="packQuantity"
                placeholder="0"
                required
                step="any"
                type="text"
                value={packQuantity}
                onChange={(event) => {
                  setPackQuantity(event.target.value);
                  markChanged();
                  clearError("packQuantity");
                }}
              />
              <SelectField
                description="Used for both purchased and available quantities."
                error={
                  unsupportedUnit
                    ? "This unit is no longer supported. Choose another unit."
                    : errors.unit
                }
                label="Unit"
                name="unit"
                required
                value={unit}
                onChange={(event) => {
                  setUnit(event.target.value);
                  markChanged();
                  clearError("unit");
                }}
              >
                <option value="">Select a unit</option>
                {unsupportedUnit ? (
                  <option value={unit} disabled>
                    {unit} — no longer supported
                  </option>
                ) : null}
                {(
                  [
                    { dimension: "MASS", label: "Mass" },
                    { dimension: "VOLUME", label: "Volume" },
                    { dimension: "COUNT", label: "Count" },
                  ] as const
                ).map((group) => (
                  <optgroup key={group.dimension} label={group.label}>
                    {units
                      .filter((option) => option.dimension === group.dimension)
                      .map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label} ({option.abbreviation})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </SelectField>
            </div>
          </section>

          <section
            className="border-t border-slate-200 p-5 sm:p-7"
            aria-labelledby="stock-heading"
          >
            <h2
              className="text-xl font-semibold tracking-tight text-slate-950"
              id="stock-heading"
            >
              Available stock
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Stock status is calculated automatically from the available
              quantity and purchase quantity.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)] sm:items-start">
              <TextField
                description={
                  unit
                    ? `Enter the quantity currently available in ${unit === "item" ? "items" : unit}.`
                    : "Choose a unit above, then enter the quantity currently available."
                }
                error={errors.stockQuantity}
                inputMode="decimal"
                label="Stock quantity"
                min="0"
                name="stockQuantity"
                placeholder="0"
                required
                step="any"
                type="text"
                value={stockQuantity}
                onChange={(event) => {
                  setStockQuantity(event.target.value);
                  markChanged();
                  clearError("stockQuantity");
                }}
              />
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                aria-live="polite"
              >
                <p className="text-sm font-medium text-slate-700">
                  Calculated stock status
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {stockStatus ?? "Enter stock details"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Zero is out of stock. Less than one purchase quantity is low
                  stock.
                </p>
              </div>
            </div>
          </section>

          <div className="px-5 pb-5 sm:px-7 sm:pb-7">
            <FormActions>
              <button
                className={secondaryActionClassName}
                onClick={leaveForm}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-950 px-6 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "Saving material…"
                  : materialId || savedMaterialId
                    ? "Save changes"
                    : "Create material"}
              </button>
            </FormActions>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
