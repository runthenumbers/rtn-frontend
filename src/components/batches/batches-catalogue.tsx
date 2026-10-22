"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { EmptyState } from "@/components/ui/feedback";
import {
  batchStatuses,
  getMockBatches,
  subscribeToMockBatches,
  type BatchStatus,
  type BatchViewModel,
} from "@/lib/batches/mock-batches";
import {
  formatCurrencyDecimal,
  formatUnitCostDecimal,
  type CurrencyCode,
} from "@/lib/domain/currencies";
import {
  getMockWorkspaceServerSnapshot,
  getMockWorkspaceSnapshot,
  subscribeToMockWorkspace,
} from "@/lib/onboarding/mock-workspace";
import { routes } from "@/lib/routes";

const primaryActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";

const inputClassName =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20";

export function BatchesCatalogue() {
  const workspace = useSyncExternalStore(
    subscribeToMockWorkspace,
    getMockWorkspaceSnapshot,
    getMockWorkspaceServerSnapshot,
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const currency: CurrencyCode = workspace?.baseCurrency ?? "GBP";
  const journey = "new" as const;
  const batches = useSyncExternalStore(
    subscribeToMockBatches,
    () => getMockBatches(journey),
    () => getMockBatches(journey),
  );

  const filteredBatches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return batches.filter((batch) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        batch.name.toLocaleLowerCase().includes(normalizedQuery) ||
        batch.reference.toLocaleLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "all" || batch.status === status;

      return matchesQuery && matchesStatus;
    });
  }, [batches, query, status]);

  const hasFilters = query.trim().length > 0 || status !== "all";

  function clearFilters() {
    setQuery("");
    setStatus("all");
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-[0.12em] text-emerald-800 uppercase">
            {workspace?.businessName ?? "Your workspace"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Batches
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Find planned and completed production runs, then review their output
            and recorded costs.
          </p>
        </div>

        <Link className={primaryActionClassName} href={routes.newBatch}>
          Create batch
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No batches yet"
            description="Create your first batch when you are ready to bring materials, packaging, output, and production costs together."
            action={
              <Link className={primaryActionClassName} href={routes.newBatch}>
                Create your first batch
              </Link>
            }
          />
        </div>
      ) : (
        <section className="mt-10" aria-labelledby="batches-list-heading">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-slate-950"
                id="batches-list-heading"
              >
                Batch catalogue
              </h2>
              <p className="mt-1 text-sm text-slate-600" aria-live="polite">
                {filteredBatches.length} of {batches.length} batches
              </p>
            </div>
            <p className="text-sm text-slate-500">Costs shown in {currency}</p>
          </div>

          <div
            className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(14rem,1fr)_14rem]"
            role="search"
            aria-label="Filter batches"
          >
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              Search
              <input
                className={inputClassName}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Batch name or reference"
                type="search"
                value={query}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              Status
              <select
                className={inputClassName}
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="all">All statuses</option>
                {batchStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredBatches.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No matching batches"
                description="Try a different batch name, reference, or production status."
                action={
                  hasFilters ? (
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                      onClick={clearFilters}
                      type="button"
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <BatchesTable batches={filteredBatches} currency={currency} />
              <BatchesCards batches={filteredBatches} currency={currency} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

function BatchesTable({
  batches,
  currency,
}: {
  batches: readonly BatchViewModel[];
  currency: CurrencyCode;
}) {
  return (
    <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] border-collapse text-left">
          <caption className="sr-only">
            Production batches with status, schedule, output, yield, and costs
          </caption>
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
            <tr>
              <th className="px-5 py-3" scope="col">
                Batch
              </th>
              <th className="px-5 py-3" scope="col">
                Status
              </th>
              <th className="px-5 py-3" scope="col">
                Production date
              </th>
              <th className="px-5 py-3" scope="col">
                Output
              </th>
              <th className="px-5 py-3 text-right" scope="col">
                Total cost
              </th>
              <th className="px-5 py-3 text-right" scope="col">
                Cost per unit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {batches.map((batch) => (
              <tr className="group hover:bg-slate-50" key={batch.id}>
                <th className="px-5 py-4" scope="row">
                  <Link
                    className="font-semibold text-slate-950 underline-offset-4 group-hover:text-emerald-800 group-hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    href={batchHref(batch.id)}
                  >
                    {batch.name}
                  </Link>
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {batch.reference}
                  </span>
                </th>
                <td className="px-5 py-4">
                  <BatchStatusBadge status={batch.status} />
                </td>
                <td className="px-5 py-4 text-sm text-slate-700">
                  <span className="block text-xs text-slate-500">
                    {batch.dateLabel}
                  </span>
                  <time dateTime={batch.date}>{formatDate(batch.date)}</time>
                </td>
                <td className="px-5 py-4 text-sm text-slate-700">
                  <span className="font-medium text-slate-950">
                    {batch.output}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {batch.yield}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-sm font-semibold text-slate-950 tabular-nums">
                  {formatCurrencyDecimal(batch.cost.total, currency)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-semibold text-slate-950 tabular-nums">
                  {formatUnitCostDecimal(batch.cost.unit, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchesCards({
  batches,
  currency,
}: {
  batches: readonly BatchViewModel[];
  currency: CurrencyCode;
}) {
  return (
    <ul className="mt-5 grid gap-4 lg:hidden">
      {batches.map((batch) => (
        <li
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          key={batch.id}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase">
                {batch.reference}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                <Link
                  className="underline-offset-4 hover:text-emerald-800 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  href={batchHref(batch.id)}
                >
                  {batch.name}
                </Link>
              </h3>
            </div>
            <BatchStatusBadge status={batch.status} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-200 pt-4">
            <div>
              <dt className="text-xs font-medium text-slate-500">
                {batch.dateLabel}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                <time dateTime={batch.date}>{formatDate(batch.date)}</time>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Output</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {batch.output}
                <span className="block font-normal text-slate-500">
                  {batch.yield}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Total cost</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950 tabular-nums">
                {formatCurrencyDecimal(batch.cost.total, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">
                Cost per unit
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950 tabular-nums">
                {formatUnitCostDecimal(batch.cost.unit, currency)}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const colorClassName = {
    Completed: "bg-emerald-100 text-emerald-900",
    "In production": "bg-blue-100 text-blue-900",
    Planned: "bg-amber-100 text-amber-900",
  }[status];

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${colorClassName}`}
    >
      {status}
    </span>
  );
}

export function batchHref(batchId: string) {
  return routes.batch.replace("[batchId]", batchId);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
