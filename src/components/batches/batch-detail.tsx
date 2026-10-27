"use client";

import Link from "next/link";

import {
  BatchStatusBadge,
  formatDate,
} from "@/components/batches/batches-catalogue";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getMockBatch,
  type BatchLineViewModel,
} from "@/lib/batches/mock-batches";
import {
  formatCurrencyDecimal,
  formatUnitCostDecimal,
} from "@/lib/domain/currencies";
import { useWorkspace } from "@/components/auth/auth-provider";
import { routes } from "@/lib/routes";

const secondaryActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function BatchDetail({ batchId }: { batchId: string }) {
  const { user: session } = useAuth();
  const workspace = useWorkspace();

  if (!session) {
    return <LoadingState label="Loading batch details" />;
  }

  const batch = getMockBatch(batchId, "new");

  if (!batch) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState
          title="Batch not found"
          description="This batch may no longer be available, or the link may be incorrect. Return to the catalogue to choose another batch."
          action={
            <Link className={secondaryActionClassName} href={routes.batches}>
              Back to batches
            </Link>
          }
        />
      </div>
    );
  }

  const currency: string = workspace?.baseCurrency ?? "GBP";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        href={routes.batches}
      >
        ← Back to batches
      </Link>

      <header className="mt-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-[0.12em] text-emerald-800 uppercase">
              {batch.reference}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              {batch.name}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              {batch.notes}
            </p>
          </div>
          <div className="pt-1">
            <BatchStatusBadge status={batch.status} />
          </div>
        </div>
      </header>

      <section className="mt-10" aria-labelledby="production-summary-heading">
        <h2 className="sr-only" id="production-summary-heading">
          Production summary
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Reference" value={batch.reference} />
          <SummaryCard
            label={batch.dateLabel}
            value={formatDate(batch.date)}
            dateTime={batch.date}
          />
          <SummaryCard label="Expected output" value={batch.output} />
          <SummaryCard label="Production yield" value={batch.yield} />
        </dl>
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <section aria-labelledby="formulation-heading">
          <div>
            <h2
              className="text-xl font-semibold tracking-tight text-slate-950"
              id="formulation-heading"
            >
              Formulation and materials
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Recorded quantities and line costs for this batch. This view is
              read-only.
            </p>
          </div>

          <BatchLinesTable
            currency={currency}
            lines={batch.lines}
            batchName={batch.name}
          />
          <BatchLinesList currency={currency} lines={batch.lines} />
        </section>

        <aside
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          aria-labelledby="cost-summary-heading"
        >
          <h2
            className="text-xl font-semibold tracking-tight text-slate-950"
            id="cost-summary-heading"
          >
            Cost summary
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Recorded values shown in {currency}.
          </p>
          <dl className="mt-5 divide-y divide-slate-200">
            <CostRow
              label="Materials"
              value={formatCurrencyDecimal(batch.cost.materials, currency)}
            />
            <CostRow
              label="Packaging"
              value={formatCurrencyDecimal(batch.cost.packaging, currency)}
            />
            <CostRow
              label="Production costs"
              value={formatCurrencyDecimal(batch.cost.production, currency)}
            />
            <div className="flex items-baseline justify-between gap-4 py-4">
              <dt className="font-semibold text-slate-950">Total batch cost</dt>
              <dd className="text-lg font-semibold text-slate-950 tabular-nums">
                {formatCurrencyDecimal(batch.cost.total, currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-4">
              <dt className="text-sm font-medium text-slate-600">
                Cost per unit
              </dt>
              <dd className="text-lg font-semibold text-emerald-900 tabular-nums">
                {formatUnitCostDecimal(batch.cost.unit, currency)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
            Costs are stored batch values and are shown for review; this screen
            does not recalculate them.
          </p>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  dateTime,
  label,
  value,
}: {
  dateTime?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-2 font-semibold text-slate-950">
        {dateTime ? <time dateTime={dateTime}>{value}</time> : value}
      </dd>
    </div>
  );
}

function BatchLinesTable({
  batchName,
  currency,
  lines,
}: {
  batchName: string;
  currency: string;
  lines: readonly BatchLineViewModel[];
}) {
  return (
    <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-left">
          <caption className="sr-only">
            Formulation and production cost lines for {batchName}
          </caption>
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
            <tr>
              <th className="px-5 py-3" scope="col">
                Item
              </th>
              <th className="px-5 py-3" scope="col">
                Category
              </th>
              <th className="px-5 py-3 text-right" scope="col">
                Quantity
              </th>
              <th className="px-5 py-3 text-right" scope="col">
                Line cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lines.map((line) => (
              <tr key={line.id}>
                <th
                  className="px-5 py-4 text-sm font-semibold text-slate-950"
                  scope="row"
                >
                  {line.name}
                </th>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {line.category}
                </td>
                <td className="px-5 py-4 text-right text-sm text-slate-700">
                  {line.quantity}
                </td>
                <td className="px-5 py-4 text-right text-sm font-semibold text-slate-950 tabular-nums">
                  {formatUnitCostDecimal(line.lineCost, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchLinesList({
  currency,
  lines,
}: {
  currency: string;
  lines: readonly BatchLineViewModel[];
}) {
  return (
    <ul className="mt-5 grid gap-3 sm:hidden">
      {lines.map((line) => (
        <li
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          key={line.id}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-950">{line.name}</p>
              <p className="mt-1 text-xs text-slate-500">{line.category}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-slate-950 tabular-nums">
              {formatUnitCostDecimal(line.lineCost, currency)}
            </p>
          </div>
          <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
            Quantity: <span className="font-medium">{line.quantity}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 text-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-950 tabular-nums">{value}</dd>
    </div>
  );
}
