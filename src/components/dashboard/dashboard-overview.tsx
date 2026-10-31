"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import {
  batchHref,
  BatchStatusBadge,
} from "@/components/batches/batches-catalogue";
import {
  getDashboard,
  DashboardError,
  type Dashboard,
} from "@/lib/dashboard/api";
import { useWorkspaceRevision } from "@/lib/workspace/use-workspace-revision";
import { formatMaterialQuantity } from "@/lib/domain/material-units";
import {
  formatCurrencyDecimal,
  formatUnitCostDecimal,
} from "@/components/batches/batches-catalogue";
import { useAuth, useWorkspace } from "@/components/auth/auth-provider";
import { routes } from "@/lib/routes";

const primaryActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";

const secondaryActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function DashboardOverview() {
  const workspace = useWorkspace();
  const { user, refresh } = useAuth();
  const canEdit =
    user?.workspaceContext?.membership.role === "OWNER" ||
    user?.workspaceContext?.membership.role === "ADMIN";
  const workspaceId = workspace?.id;
  const revision = useWorkspaceRevision(workspaceId);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    dashboard?: Dashboard;
    error?: unknown;
  }>();
  const key = `${user?.id}:${workspaceId}:${revision}:${attempt}`;
  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    void getDashboard(workspaceId, controller.signal)
      .then((dashboard) => {
        if (!controller.signal.aborted) setResult({ key, dashboard });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key, error });
        if (
          error instanceof DashboardError &&
          (error.status === 401 || error.status === 404)
        )
          void refresh().catch(() => undefined);
      });
    return () => controller.abort();
  }, [workspaceId, key, refresh]);
  const current = result?.key === key ? result : undefined;
  if (!current) return <LoadingState label="Loading dashboard" />;
  if (!current.dashboard)
    return (
      <ErrorState
        title="Unable to load dashboard"
        description="Your workspace summary could not be loaded. Try again to get current estimates."
        action={
          <button
            className={secondaryActionClassName}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        }
      />
    );
  const dashboard = current.dashboard;
  const currency = dashboard.currencyCode;
  const hasBatches = dashboard.batchCount > 0;
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-[0.12em] text-emerald-800 uppercase">
            {workspace?.businessName ?? "Your workspace"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            {hasBatches ? "Production overview" : "Welcome to RTN"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            {hasBatches
              ? "Track the materials and batches shaping your current production costs."
              : "Start with the materials you purchase, then bring them together in your first production batch."}
          </p>
        </div>

        {canEdit ? (
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              className={secondaryActionClassName}
              href={routes.newMaterial}
            >
              Create material
            </Link>
            <Link className={primaryActionClassName} href={routes.newBatch}>
              Create batch
            </Link>
          </div>
        ) : null}
      </div>

      <section className="mt-10" aria-labelledby="workspace-summary-heading">
        <h2 className="sr-only" id="workspace-summary-heading">
          Workspace summary
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Materials"
            value={String(dashboard.materialCount)}
          />
          <SummaryCard label="Batches" value={String(dashboard.batchCount)} />
          <SummaryCard label="Base currency" value={currency} />
          <SummaryCard
            label="Current estimated batch costs"
            value={formatCurrencyDecimal(
              dashboard.estimatedCosts.total,
              currency,
            )}
          />
        </dl>
        <p className="mt-3 text-sm text-slate-600" role="status">
          {dashboard.estimatedCosts.calculatedBatchCount} of{" "}
          {dashboard.batchCount} batches included.{" "}
          {dashboard.estimatedCosts.unavailableBatchCount} unavailable.{" "}
          Estimates use current material prices and are not actual expenditure.
        </p>
        <dl
          className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"
          aria-label="Batches by status"
        >
          {(
            [
              ["DRAFT", "Draft"],
              ["PLANNED", "Planned"],
              ["IN_PRODUCTION", "In production"],
              ["COMPLETED", "Completed"],
            ] as const
          ).map(([status, label]) => (
            <div
              key={status}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <dt className="text-sm text-slate-600">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-950">
                {dashboard.statusCounts[status]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="recent-batches-heading">
        <div className="mb-4">
          <h2
            className="text-xl font-semibold tracking-tight text-slate-950"
            id="recent-batches-heading"
          >
            Recent batches
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {hasBatches
              ? "Review saved production work. Estimates use current material prices."
              : "Your latest production work will appear here."}
          </p>
        </div>

        {hasBatches ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <caption className="sr-only">
                  Recent production batches and their costs
                </caption>
                <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  <tr>
                    <th className="px-5 py-3" scope="col">
                      Batch
                    </th>
                    <th className="px-5 py-3" scope="col">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Output
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Batch cost
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Cost per unit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dashboard.recentBatches.map((batch) => (
                    <tr key={batch.id}>
                      <th className="px-5 py-4" scope="row">
                        <Link
                          className="text-sm font-semibold text-slate-950 underline-offset-4 hover:text-emerald-800 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          href={batchHref(batch.id)}
                        >
                          {batch.name}
                        </Link>
                        {batch.unavailableReason ? (
                          <p className="mt-1 max-w-64 text-xs font-normal text-slate-600">
                            {batch.unavailableReason}
                          </p>
                        ) : null}
                      </th>
                      <td className="px-5 py-4">
                        <BatchStatusBadge status={batch.status} />
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-slate-700">
                        {formatMaterialQuantity(
                          batch.targetOutputQuantity,
                          batch.outputUnitCode,
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-medium text-slate-900">
                        {formatCurrencyDecimal(batch.totalBatchCost, currency)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-medium text-slate-900">
                        {formatUnitCostDecimal(
                          batch.costPerOutputUnit,
                          currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No batches yet"
            description="Create your first batch when you are ready to bring priced materials and target output together."
            action={
              canEdit ? (
                <Link className={primaryActionClassName} href={routes.newBatch}>
                  Create your first batch
                </Link>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-3 truncate text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </dd>
    </div>
  );
}
