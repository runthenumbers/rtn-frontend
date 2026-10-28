"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

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
import { saveBatch, listBatches, BatchError } from "@/lib/batches/api";
import type { BatchLineCategory } from "@/lib/batches/types";
import { draftKey, parseDraft } from "@/lib/batches/draft";
import { validDecimal } from "@/lib/materials/types";
import { useBatches } from "./batches-provider";
import {
  formatCurrencyDecimal,
  formatUnitCostDecimal,
} from "@/lib/domain/currencies";
import {
  formatMaterialQuantity,
  isMaterialUnit,
  type MaterialUnit,
} from "@/lib/domain/material-units";
import type { MaterialSummary } from "@/lib/materials/types";
import { useMaterials } from "@/components/materials/materials-provider";
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
  notes?: string;
  fixedCosts?: string;
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

export function BatchForm() {
  const { currencies } = useCatalogues();
  const { user: session } = useAuth();
  const workspace = useWorkspace();
  const { items: materials, status: materialStatus, retry } = useMaterials();

  if (!session) {
    return <LoadingState label="Loading batch builder" />;
  }

  if (materialStatus === "loading")
    return <LoadingState label="Loading batch materials" />;
  if (materialStatus === "error")
    return (
      <ErrorState
        title="Unable to load materials"
        description="Your persisted materials could not be loaded."
        action={
          <button className={secondaryActionClassName} onClick={retry}>
            Try again
          </button>
        }
      />
    );

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

  if (session.workspaceContext?.membership.role === "MEMBER")
    return (
      <ErrorState
        title="Batch creation is restricted"
        description="Only workspace owners and administrators can create batches."
        action={
          <Link className={secondaryActionClassName} href={routes.batches}>
            Back to batches
          </Link>
        }
      />
    );

  return (
    <BatchFormFields
      key={`${session.id}:${workspace.id}`}
      userId={session.id}
      workspaceId={workspace.id}
      currency={workspace.baseCurrency}
      materials={materials}
    />
  );
}

function BatchFormFields({
  currency,
  userId,
  workspaceId,
  materials,
}: {
  currency: string;
  userId: string;
  workspaceId: string;
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

  const { refresh } = useAuth();
  const { saved: batchSaved } = useBatches();
  const submittingRef = useRef(false);
  const { user } = useAuth();
  const canEdit =
    user?.workspaceContext?.membership.role === "OWNER" ||
    user?.workspaceContext?.membership.role === "ADMIN";
  const recoveryKey = draftKey(userId, workspaceId);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [fixedCosts, setFixedCosts] = useState<
    { id: string; name: string; amount: string }[]
  >([]);
  const [costErrors, setCostErrors] = useState<
    Record<string, { name?: string; amount?: string }>
  >({});
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    // Recover only this account/workspace's unfinished form after reload or sign-in.
    queueMicrotask(() => {
      try {
        const draft = parseDraft(window.sessionStorage.getItem(recoveryKey));
        if (draft) {
          setName(draft.name);
          setReference(draft.reference);
          setDate(draft.date);
          setOutputQuantity(draft.outputQuantity);
          setOutputUnit(draft.outputUnit);
          setNotes(draft.notes);
          setLines(draft.lines);
          setFixedCosts(draft.fixedCosts);
          setIsDirty(true);
          setRecoveryNotice(
            "Your unfinished batch was restored. Review it before saving.",
          );
        }
      } catch {
        setRecoveryNotice(
          "Browser draft recovery is unavailable. Keep this page open until your batch is saved.",
        );
      }
      setRecoveryReady(true);
      nameRef.current?.focus();
    });
  }, [recoveryKey]);
  useEffect(() => {
    if (!recoveryReady || !isDirty) return;
    try {
      window.sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({
          name,
          reference,
          date,
          outputQuantity,
          outputUnit,
          notes,
          lines,
          fixedCosts,
        }),
      );
    } catch {
      /* The in-memory form remains usable when browser storage is disabled. */
    }
  }, [
    recoveryReady,
    recoveryKey,
    isDirty,
    name,
    reference,
    date,
    outputQuantity,
    outputUnit,
    notes,
    lines,
    fixedCosts,
  ]);
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
        fixedCosts,
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
  }, [
    lines,
    materials,
    outputQuantity,
    outputUnit,
    availableUnits,
    fixedCosts,
  ]);

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
    const id = crypto.randomUUID();
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
      try {
        window.sessionStorage.removeItem(recoveryKey);
      } catch {}
      router.push(routes.batches);
    }
  }

  function validate() {
    const nextErrors: FormErrors = {};
    const nextLineErrors: Record<string, LineErrors> = {};
    if (name.trim().length < 2 || name.trim().length > 160)
      nextErrors.name = "Enter a batch name of at least 2 characters.";
    if (reference.trim().length < 2 || reference.trim().length > 80)
      nextErrors.reference = "Enter a batch reference.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      nextErrors.date = "Choose a planned production date.";
    if (!validDecimal(outputQuantity, true))
      nextErrors.outputQuantity = "Enter a target output greater than zero.";
    if (!isMaterialUnit(outputUnit) || !availableUnits.has(outputUnit))
      nextErrors.outputUnit = "Choose a target output unit.";
    if (outputUnit === "item" && /\.[0-9]*[1-9]/.test(outputQuantity)) {
      nextErrors.outputQuantity = "Count-based output must be a whole number.";
    }
    if (notes.length > 5000) nextErrors.notes = "Use at most 5000 characters.";
    const nextCostErrors: typeof costErrors = {};
    fixedCosts.forEach((cost) => {
      const fields: { name?: string; amount?: string } = {};
      if (!cost.name.trim() || cost.name.trim().length > 160)
        fields.name = "Enter a cost name of 1–160 characters.";
      if (!validDecimal(cost.amount))
        fields.amount =
          "Enter zero or a positive amount with up to 6 decimal places.";
      if (Object.keys(fields).length) nextCostErrors[cost.id] = fields;
    });
    if (Object.keys(nextCostErrors).length)
      nextErrors.fixedCosts = "Review the highlighted fixed costs.";
    setCostErrors(nextCostErrors);
    const selected = new Set<string>();
    lines.forEach((line) => {
      const material = materials.find((item) => item.id === line.materialId);
      if (!material)
        nextLineErrors[line.id] = { material: "Choose a material." };
      else if (selected.has(material.id))
        nextLineErrors[line.id] = { material: "Use each material only once." };
      else if (!validDecimal(line.quantity, true))
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
      else if (line.unit === "item" && /\.[0-9]*[1-9]/.test(line.quantity))
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
    if (submittingRef.current || !canEdit) return;
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
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const saved = await saveBatch(workspaceId, {
        name,
        reference,
        notes,
        plannedDate: date || null,
        targetOutputQuantity: outputQuantity,
        outputUnitCode: outputUnit,
        lines: lines.map((line) => ({
          materialId: line.materialId,
          quantity: line.quantity,
          unitCode: line.unit as MaterialUnit,
        })),
        fixedCosts: fixedCosts.map((cost) => ({
          name: cost.name,
          amount: cost.amount,
        })),
      });
      batchSaved(saved);
      setIsDirty(false);
      try {
        window.sessionStorage.removeItem(recoveryKey);
      } catch {}
      router.push(batchHref(saved.id));
    } catch (failure) {
      if (failure instanceof BatchError && failure.status === 400) {
        const fields = failure.fieldErrors;
        setErrors({
          name: fields.name?.[0],
          reference: fields.reference?.[0],
          date: fields.plannedDate?.[0],
          notes: fields.notes?.[0],
          outputQuantity: fields.targetOutputQuantity?.[0],
          outputUnit: fields.outputUnitCode?.[0],
          lines: fields.lines?.[0],
          fixedCosts: fields.fixedCosts?.[0],
        });
        setLineErrors(
          Object.fromEntries(
            lines.map((line, index) => [
              line.id,
              {
                material: fields[`lines.${index}.materialId`]?.[0],
                quantity: fields[`lines.${index}.quantity`]?.[0],
                unit: fields[`lines.${index}.unitCode`]?.[0],
              },
            ]),
          ),
        );
        setCostErrors(
          Object.fromEntries(
            fixedCosts.map((cost, index) => [
              cost.id,
              {
                name: fields[`fixedCosts.${index}.name`]?.[0],
                amount: fields[`fixedCosts.${index}.amount`]?.[0],
              },
            ]),
          ),
        );
        setFormError(
          "Check the highlighted fields and try again. Your inputs are still here.",
        );
        requestAnimationFrame(() =>
          formRef.current
            ?.querySelector<HTMLElement>("[aria-invalid='true']")
            ?.focus(),
        );
      } else if (failure instanceof BatchError && failure.status === 401) {
        setFormError(
          "Your session expired. Sign in again, then return to Create batch to recover your inputs.",
        );
        void refresh().catch(() => undefined);
      } else if (failure instanceof BatchError && failure.status === 403) {
        setFormError(
          "You no longer have permission to create batches. Your draft has been kept.",
        );
      } else if (failure instanceof BatchError && failure.status === 404) {
        setFormError(
          "This workspace is no longer available. Your draft has been kept.",
        );
      } else if (failure instanceof BatchError && failure.status === 409) {
        setErrors({ reference: "That reference is already in use." });
        setUncertain(true);
        setFormError(
          "A batch with this reference already exists. Check saved batches before choosing a different reference.",
        );
      } else {
        setUncertain(true);
        setFormError(
          "We couldn't confirm whether the batch was saved. Check saved batches before retrying. Your inputs have been kept.",
        );
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function checkSavedBatch() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const batches = await listBatches(workspaceId);
      const match = batches.find(
        (batch) => batch.reference === reference.trim(),
      );
      if (match) router.push(batchHref(match.id));
      else {
        setUncertain(false);
        setFormError(
          "No saved batch with this reference was found. You can retry saving.",
        );
      }
    } catch (failure) {
      setFormError(
        "Saved batches could not be checked. Keep your reference unchanged and try checking again.",
      );
      if (failure instanceof BatchError && failure.status === 401)
        void refresh().catch(() => undefined);
    } finally {
      submittingRef.current = false;
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

      {recoveryNotice ? (
        <p className="mt-4 text-sm text-slate-600" role="status">
          {recoveryNotice}
        </p>
      ) : null}
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
                {uncertain ? (
                  <button
                    className={secondaryActionClassName}
                    disabled={isSubmitting}
                    type="button"
                    onClick={() => void checkSavedBatch()}
                  >
                    Check saved batch
                  </button>
                ) : null}
              </div>
            ) : null}
            <fieldset
              disabled={isSubmitting || !canEdit || !recoveryReady}
              className="min-w-0"
            >
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
                    maxLength={160}
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
                    maxLength={80}
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
                      type="text"
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
                      maxLength={5000}
                      error={errors.notes}
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
                      Add each material once. Units are limited to the
                      material’s measurement type.
                    </p>
                  </div>
                  <button
                    className={secondaryActionClassName}
                    disabled={lines.length >= 500}
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
                            type="text"
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
              <section
                className="border-t border-slate-200 p-5 sm:p-7"
                aria-labelledby="fixed-costs-heading"
              >
                <h2
                  className="text-xl font-semibold text-slate-950"
                  id="fixed-costs-heading"
                >
                  Fixed costs
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Add labour, utilities or other production costs in {currency}.
                </p>
                {errors.fixedCosts ? (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {errors.fixedCosts}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-4">
                  {fixedCosts.map((cost, index) => (
                    <fieldset
                      className="min-w-0 rounded-lg border border-slate-200 p-4"
                      key={cost.id}
                    >
                      <legend className="px-1 text-sm font-semibold">
                        Fixed cost {index + 1}
                      </legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          label="Cost name"
                          name={`cost-${cost.id}-name`}
                          maxLength={160}
                          error={costErrors[cost.id]?.name}
                          value={cost.name}
                          onChange={(event) => {
                            setFixedCosts((items) =>
                              items.map((item) =>
                                item.id === cost.id
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            );
                            markChanged();
                          }}
                        />
                        <TextField
                          label={`Amount (${currency})`}
                          name={`cost-${cost.id}-amount`}
                          inputMode="decimal"
                          error={costErrors[cost.id]?.amount}
                          value={cost.amount}
                          onChange={(event) => {
                            setFixedCosts((items) =>
                              items.map((item) =>
                                item.id === cost.id
                                  ? { ...item, amount: event.target.value }
                                  : item,
                              ),
                            );
                            markChanged();
                          }}
                        />
                      </div>
                      <button
                        className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-red-800 focus-visible:outline-2"
                        type="button"
                        aria-label={`Remove cost ${index + 1}`}
                        onClick={() => {
                          setFixedCosts((items) =>
                            items.filter((item) => item.id !== cost.id),
                          );
                          markChanged();
                        }}
                      >
                        Remove cost
                      </button>
                    </fieldset>
                  ))}
                </div>
                <button
                  className={`${secondaryActionClassName} mt-4`}
                  disabled={fixedCosts.length >= 100}
                  type="button"
                  onClick={() => {
                    setFixedCosts((items) => [
                      ...items,
                      { id: crypto.randomUUID(), name: "", amount: "" },
                    ]);
                    markChanged();
                  }}
                >
                  Add fixed cost
                </button>
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
                    {isSubmitting ? "Saving draft…" : "Save draft batch"}
                  </button>
                </FormActions>
              </div>
            </fieldset>
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
                label="Fixed costs"
                value={
                  calculation
                    ? formatCurrencyDecimal(
                        calculation.fixedCostSubtotal,
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
              Estimates use current material prices, fixed costs and compatible
              unit conversion. Quantities and fixed costs are saved; material
              prices may change before production.
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
