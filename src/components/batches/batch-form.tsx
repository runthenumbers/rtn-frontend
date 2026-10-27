"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import { useCatalogues } from "@/components/catalogues/catalogues-provider";
import { FormError } from "@/components/auth/form-error";
import { batchHref } from "@/components/batches/batches-catalogue";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import {
  FormActions,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/ui/form-controls";
import { useAuth } from "@/components/auth/auth-provider";
import { calculateBatchCost } from "@/lib/batches/batch-calculations";
import {
  saveMockBatch,
  type BatchLineCategory,
} from "@/lib/batches/mock-batches";
import {
  formatCurrencyDecimal,
  formatUnitCostDecimal,
} from "@/lib/domain/currencies";
import {
  formatMaterialQuantity,
  isMaterialUnit,
  type MaterialUnit,
} from "@/lib/domain/material-units";
import {
  getMockMaterials,
  subscribeToMockMaterials,
  type MaterialSummary,
} from "@/lib/materials/mock-materials";
import { useWorkspace } from "@/components/auth/auth-provider";
import { routes } from "@/lib/routes";

interface DraftLine {
  id: string;
  materialId: string;
  quantity: string;
  unit: string;
}

interface FormErrors {
  date?: string;
  lines?: string;
  name?: string;
  outputQuantity?: string;
  outputUnit?: string;
  reference?: string;
}

interface LineErrors {
  material?: string;
  quantity?: string;
  unit?: string;
}

const secondaryActionClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:w-auto";
const emptyMaterials: readonly MaterialSummary[] = [];

export function BatchForm() {
  const { currencies } = useCatalogues();
  const { user: session } = useAuth();
  const workspace = useWorkspace();
  const journey = "new" as const;
  const materials = useSyncExternalStore(
    subscribeToMockMaterials,
    () => getMockMaterials(journey),
    () => emptyMaterials,
  );

  if (!session) {
    return <LoadingState label="Loading batch builder" />;
  }

  if (
    !workspace ||
    !currencies.some((option) => option.code === workspace.baseCurrency)
  ) {
    return (
      <ErrorState
        title="Choose a supported workspace currency"
        description="Update your base currency in Settings before creating a batch."
        action={
          <Link className={secondaryActionClassName} href={routes.settings}>
            Open settings
          </Link>
        }
      />
    );
  }

  return (
    <BatchFormFields
      currency={workspace.baseCurrency}
      journey={"new"}
      materials={materials}
    />
  );
}

function BatchFormFields({
  currency,
  journey,
  materials,
}: {
  currency: string;
  journey: "new" | "returning";
  materials: readonly MaterialSummary[];
}) {
  const { units } = useCatalogues();
  const availableUnits = useMemo(
    () =>
      new Set(
        units
          .filter((unit) => isMaterialUnit(unit.code))
          .map((unit) => unit.code),
      ),
    [units],
  );

  function getCompatibleUnits(code: MaterialUnit) {
    const source = units.find((unit) => unit.code === code);
    return source
      ? units.filter(
          (unit) =>
            availableUnits.has(unit.code) &&
            unit.dimension === source.dimension,
        )
      : [];
  }

  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const nextLineId = useRef(2);
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("");
  const [outputUnit, setOutputUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { id: "line-1", materialId: "", quantity: "", unit: "" },
  ]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [lineErrors, setLineErrors] = useState<Record<string, LineErrors>>({});
  const [formError, setFormError] = useState<string>();
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => nameRef.current?.focus(), []);
  useEffect(() => {
    if (!isDirty) return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  const calculation = useMemo(() => {
    if (
      !outputQuantity ||
      !isMaterialUnit(outputUnit) ||
      !availableUnits.has(outputUnit) ||
      lines.some(
        (line) =>
          !line.materialId ||
          !line.quantity ||
          !isMaterialUnit(line.unit) ||
          !availableUnits.has(line.unit),
      )
    ) {
      return undefined;
    }
    try {
      return calculateBatchCost({
        lines: lines.map((line) => {
          const material = materials.find(
            (item) => item.id === line.materialId,
          )!;
          return {
            category: lineCategory(material),
            materialId: material.id,
            packQuantity: String(material.packQuantity),
            purchasePrice: String(material.purchasePrice),
            purchaseUnit: material.unit,
            quantity: line.quantity,
            quantityUnit: line.unit as MaterialUnit,
          };
        }),
        targetOutputQuantity: outputQuantity,
        targetOutputUnit: outputUnit,
      });
    } catch {
      return undefined;
    }
  }, [lines, materials, outputQuantity, outputUnit, availableUnits]);

  function markChanged() {
    setIsDirty(true);
    setFormError(undefined);
  }

  function updateLine(id: string, update: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...update } : line)),
    );
    setLineErrors((current) => ({ ...current, [id]: {} }));
    markChanged();
  }

  function addLine() {
    const id = `line-${nextLineId.current++}`;
    setLines((current) => [
      ...current,
      { id, materialId: "", quantity: "", unit: "" },
    ]);
    markChanged();
  }

  function removeLine(id: string) {
    if (lines.length === 1) return;
    const lineNumber = lines.findIndex((line) => line.id === id) + 1;
    if (window.confirm(`Remove formulation line ${lineNumber}?`)) {
      setLines((current) => current.filter((line) => line.id !== id));
      markChanged();
    }
  }

  function leaveForm() {
    if (!isDirty || window.confirm("Leave without saving this batch?")) {
      setIsDirty(false);
      router.push(routes.batches);
    }
  }

  function validate() {
    const nextErrors: FormErrors = {};
    const nextLineErrors: Record<string, LineErrors> = {};
    if (name.trim().length < 2)
      nextErrors.name = "Enter a batch name of at least 2 characters.";
    if (reference.trim().length < 2)
      nextErrors.reference = "Enter a batch reference.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      nextErrors.date = "Choose a planned production date.";
    if (!outputQuantity || Number(outputQuantity) <= 0)
      nextErrors.outputQuantity = "Enter a target output greater than zero.";
    if (!isMaterialUnit(outputUnit) || !availableUnits.has(outputUnit))
      nextErrors.outputUnit = "Choose a target output unit.";
    if (outputUnit === "item" && !Number.isInteger(Number(outputQuantity))) {
      nextErrors.outputQuantity = "Count-based output must be a whole number.";
    }
    const selected = new Set<string>();
    lines.forEach((line) => {
      const material = materials.find((item) => item.id === line.materialId);
      if (!material)
        nextLineErrors[line.id] = { material: "Choose a material." };
      else if (selected.has(material.id))
        nextLineErrors[line.id] = { material: "Use each material only once." };
      else if (!line.quantity || Number(line.quantity) <= 0)
        nextLineErrors[line.id] = {
          quantity: "Enter a required quantity greater than zero.",
        };
      else if (
        !isMaterialUnit(line.unit) ||
        !getCompatibleUnits(material.unit).some(
          (unit) => unit.code === line.unit,
        )
      )
        nextLineErrors[line.id] = { unit: "Choose a compatible unit." };
      else if (line.unit === "item" && !Number.isInteger(Number(line.quantity)))
        nextLineErrors[line.id] = {
          quantity: "Count-based quantities must be whole numbers.",
        };
      if (material) selected.add(material.id);
    });
    if (Object.keys(nextLineErrors).length)
      nextErrors.lines = "Review the highlighted formulation lines.";
    setErrors(nextErrors);
    setLineErrors(nextLineErrors);
    return Object.keys(nextErrors).length === 0 && calculation;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const validCalculation = validate();
    if (
      !validCalculation ||
      !isMaterialUnit(outputUnit) ||
      !availableUnits.has(outputUnit)
    ) {
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus(),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const saved = await saveMockBatch(
        {
          calculation: validCalculation,
          date,
          lines: lines.map((line, index) => {
            const material = materials.find(
              (item) => item.id === line.materialId,
            )!;
            return {
              category: lineCategory(material),
              id: `${material.id}-${index + 1}`,
              lineCost: validCalculation.lines[index].lineCost,
              name: material.name,
              quantity: formatMaterialQuantity(
                Number(line.quantity),
                line.unit as MaterialUnit,
              ),
            };
          }),
          name,
          notes,
          output: formatMaterialQuantity(Number(outputQuantity), outputUnit),
          reference,
        },
        journey,
      );
      setIsDirty(false);
      router.push(batchHref(saved.id));
    } catch (error) {
      setFormError(
        error instanceof Error && error.message === "DUPLICATE_REFERENCE"
          ? "That batch reference is already in use. Choose a unique reference."
          : "We couldn't create this batch. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        href={routes.batches}
        onClick={(event) => {
          if (isDirty && !window.confirm("Leave without saving this batch?"))
            event.preventDefault();
        }}
      >
        ← Back to batches
      </Link>
      <header className="mt-4">
        <p className="text-sm font-bold tracking-[0.12em] text-emerald-800 uppercase">
          Batches
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
          Create batch
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
          Plan the output and formulation, then review material costs before
          saving the production run.
        </p>
      </header>

      {materials.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Add materials before building a batch"
            description="A batch needs at least one priced material. Add its purchase price, pack quantity, and unit first, then return here to build the formulation."
            action={
              <Link
                className={secondaryActionClassName}
                href={routes.newMaterial}
              >
                Add your first material
              </Link>
            }
          />
        </div>
      ) : (
        <form
          className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start"
          noValidate
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {formError ? (
              <div className="p-5 pb-0 sm:p-7 sm:pb-0">
                <FormError>{formError}</FormError>
              </div>
            ) : null}
            <section
              className="p-5 sm:p-7"
              aria-labelledby="batch-details-heading"
            >
              <h2
                className="text-xl font-semibold text-slate-950"
                id="batch-details-heading"
              >
                Batch details
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use a recognisable name and unique internal reference for this
                planned run.
              </p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <TextField
                  error={errors.name}
                  inputRef={nameRef}
                  label="Batch name"
                  name="name"
                  placeholder="e.g. Autumn hand lotion"
                  required
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    markChanged();
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                />
                <TextField
                  error={errors.reference}
                  label="Batch reference"
                  name="reference"
                  placeholder="e.g. HL-2026-008"
                  required
                  value={reference}
                  onChange={(event) => {
                    setReference(event.target.value);
                    markChanged();
                    setErrors((current) => ({
                      ...current,
                      reference: undefined,
                    }));
                  }}
                />
                <TextField
                  error={errors.date}
                  label="Planned date"
                  name="date"
                  required
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    markChanged();
                    setErrors((current) => ({ ...current, date: undefined }));
                  }}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
                  <TextField
                    error={errors.outputQuantity}
                    inputMode="decimal"
                    label="Target output"
                    min="0"
                    name="outputQuantity"
                    required
                    step="any"
                    type="number"
                    value={outputQuantity}
                    onChange={(event) => {
                      setOutputQuantity(event.target.value);
                      markChanged();
                      setErrors((current) => ({
                        ...current,
                        outputQuantity: undefined,
                      }));
                    }}
                  />
                  <SelectField
                    error={errors.outputUnit}
                    label="Unit"
                    name="outputUnit"
                    required
                    value={outputUnit}
                    onChange={(event) => {
                      setOutputUnit(event.target.value);
                      markChanged();
                      setErrors((current) => ({
                        ...current,
                        outputUnit: undefined,
                      }));
                    }}
                  >
                    <option value="">Select</option>
                    {units
                      .filter((unit) => availableUnits.has(unit.code))
                      .map((unit) => (
                        <option key={unit.code} value={unit.code}>
                          {unit.abbreviation}
                        </option>
                      ))}
                  </SelectField>
                </div>
                <div className="sm:col-span-2">
                  <TextareaField
                    description="Optional context for production or quality review."
                    label="Notes (optional)"
                    name="notes"
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      markChanged();
                    }}
                  />
                </div>
              </div>
            </section>

            <section
              className="border-t border-slate-200 p-5 sm:p-7"
              aria-labelledby="formulation-builder-heading"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2
                    className="text-xl font-semibold text-slate-950"
                    id="formulation-builder-heading"
                  >
                    Formulation
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Add each material once. Units are limited to the material’s
                    measurement type.
                  </p>
                </div>
                <button
                  className={secondaryActionClassName}
                  onClick={addLine}
                  type="button"
                >
                  Add line
                </button>
              </div>
              {errors.lines ? (
                <p className="mt-4 text-sm text-red-700" role="alert">
                  {errors.lines}
                </p>
              ) : null}
              <div className="mt-6 grid gap-4">
                {lines.map((line, index) => {
                  const material = materials.find(
                    (item) => item.id === line.materialId,
                  );
                  const lineResult = calculation?.lines[index];
                  return (
                    <fieldset
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      key={line.id}
                    >
                      <legend className="px-1 text-sm font-semibold text-slate-900">
                        Line {index + 1}
                      </legend>
                      <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_minmax(8rem,.55fr)_8rem_auto] md:items-start">
                        <SelectField
                          error={lineErrors[line.id]?.material}
                          label="Material"
                          name={`${line.id}-material`}
                          required
                          value={line.materialId}
                          onChange={(event) => {
                            const selected = materials.find(
                              (item) => item.id === event.target.value,
                            );
                            updateLine(line.id, {
                              materialId: event.target.value,
                              unit:
                                selected && availableUnits.has(selected.unit)
                                  ? selected.unit
                                  : "",
                            });
                          }}
                        >
                          <option value="">Select a material</option>
                          {materials.map((option) => (
                            <option
                              disabled={lines.some(
                                (other) =>
                                  other.id !== line.id &&
                                  other.materialId === option.id,
                              )}
                              key={option.id}
                              value={option.id}
                            >
                              {option.name}
                            </option>
                          ))}
                        </SelectField>
                        <TextField
                          error={lineErrors[line.id]?.quantity}
                          inputMode="decimal"
                          label="Required quantity"
                          min="0"
                          name={`${line.id}-quantity`}
                          required
                          step="any"
                          type="number"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.id, {
                              quantity: event.target.value,
                            })
                          }
                        />
                        <SelectField
                          error={lineErrors[line.id]?.unit}
                          label="Unit"
                          name={`${line.id}-unit`}
                          required
                          value={line.unit}
                          onChange={(event) =>
                            updateLine(line.id, { unit: event.target.value })
                          }
                        >
                          <option value="">Select</option>
                          {(material
                            ? getCompatibleUnits(material.unit)
                            : []
                          ).map((unit) => (
                            <option key={unit.code} value={unit.code}>
                              {unit.abbreviation}
                            </option>
                          ))}
                        </SelectField>
                        <button
                          aria-label={`Remove formulation line ${index + 1}`}
                          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-800 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={lines.length === 1}
                          onClick={() => removeLine(line.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 flex flex-col gap-1 border-t border-slate-200 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-slate-600">
                          {material
                            ? `${formatCurrencyDecimal(String(material.purchasePrice), currency)} per ${formatMaterialQuantity(material.packQuantity, material.unit)}`
                            : "Select a material to see its purchase basis."}
                        </p>
                        <p className="font-semibold text-slate-950 tabular-nums">
                          Line cost:{" "}
                          {lineResult
                            ? formatUnitCostDecimal(
                                lineResult.lineCost,
                                currency,
                              )
                            : "—"}
                        </p>
                      </div>
                    </fieldset>
                  );
                })}
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
                  {isSubmitting ? "Creating batch…" : "Create batch"}
                </button>
              </FormActions>
            </div>
          </div>

          <aside
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6"
            aria-labelledby="live-cost-heading"
            aria-live="polite"
          >
            <h2
              className="text-xl font-semibold text-slate-950"
              id="live-cost-heading"
            >
              Live cost estimate
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Calculated from purchase prices in {currency}. Complete every line
              to see totals.
            </p>
            <dl className="mt-5 divide-y divide-slate-200">
              <CostRow
                label="Materials"
                value={
                  calculation
                    ? formatCurrencyDecimal(
                        calculation.materialSubtotal,
                        currency,
                      )
                    : "—"
                }
              />
              <CostRow
                label="Packaging"
                value={
                  calculation
                    ? formatCurrencyDecimal(
                        calculation.packagingSubtotal,
                        currency,
                      )
                    : "—"
                }
              />
              <CostRow
                label="Total batch cost"
                strong
                value={
                  calculation
                    ? formatCurrencyDecimal(
                        calculation.totalBatchCost,
                        currency,
                      )
                    : "—"
                }
              />
              <CostRow
                label="Cost per output unit"
                strong
                value={
                  calculation
                    ? formatUnitCostDecimal(
                        calculation.costPerOutputUnit,
                        currency,
                      )
                    : "—"
                }
              />
            </dl>
            <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
              Preview calculations use exact decimal inputs and compatible unit
              conversion. Saved values become the mock record of cost.
            </p>
          </aside>
        </form>
      )}
    </div>
  );
}

function lineCategory(
  material: MaterialSummary,
): Exclude<BatchLineCategory, "Production cost"> {
  return material.category === "Packaging" ? "Packaging" : "Material";
}

function CostRow({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4">
      <dt
        className={
          strong ? "font-semibold text-slate-950" : "text-sm text-slate-600"
        }
      >
        {label}
      </dt>
      <dd
        className={`${strong ? "text-lg" : "text-sm"} font-semibold text-slate-950 tabular-nums`}
      >
        {value}
      </dd>
    </div>
  );
}
