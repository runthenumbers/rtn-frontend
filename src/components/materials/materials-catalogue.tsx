"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { formatCurrency } from "@/lib/dashboard/mock-dashboard";
import { formatMaterialQuantity } from "@/lib/domain/material-units";
import {
  materialCategories,
  type MaterialStockStatus,
  type MaterialSummary,
} from "@/lib/materials/types";
import { useMaterials } from "./materials-provider";
import { useAuth, useWorkspace } from "@/components/auth/auth-provider";
import { routes } from "@/lib/routes";

const stockStatuses: readonly MaterialStockStatus[] = [
  "In stock",
  "Low stock",
  "Out of stock",
];

const primaryActionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";

const inputClassName =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20";

export function MaterialsCatalogue() {
  const workspace = useWorkspace();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const currency: string = workspace?.baseCurrency ?? "GBP";
  const { items: materials, status, retry } = useMaterials();
  const { user } = useAuth();
  const role = user?.workspaceContext?.membership.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  const filteredMaterials = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return materials.filter((material) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        material.name.toLocaleLowerCase().includes(normalizedQuery) ||
        material.supplier.toLocaleLowerCase().includes(normalizedQuery);
      const matchesCategory =
        category === "all" || material.category === category;
      const matchesStock =
        stockStatus === "all" || material.stockStatus === stockStatus;

      return matchesQuery && matchesCategory && matchesStock;
    });
  }, [category, materials, query, stockStatus]);

  const hasFilters =
    query.trim().length > 0 || category !== "all" || stockStatus !== "all";

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setStockStatus("all");
  }

  if (status === "loading") return <LoadingState label="Loading materials" />;
  if (status === "error")
    return (
      <ErrorState
        title="Unable to load materials"
        description="Your materials could not be loaded. Please try again."
        action={
          <button className={primaryActionClassName} onClick={retry}>
            Try again
          </button>
        }
      />
    );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-[0.12em] text-emerald-800 uppercase">
            {workspace?.businessName ?? "Your workspace"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Materials
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Keep purchase prices, suppliers, and available stock ready for
            accurate production costing.
          </p>
        </div>

        {canEdit ? (
          <Link className={primaryActionClassName} href={routes.newMaterial}>
            Add material
          </Link>
        ) : null}
      </div>

      {materials.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No materials yet"
            description="Add your first ingredient, packaging item, or production supply to start building reliable batch costs."
            action={
              canEdit ? (
                <Link
                  className={primaryActionClassName}
                  href={routes.newMaterial}
                >
                  Add your first material
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <section className="mt-10" aria-labelledby="materials-list-heading">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-slate-950"
                id="materials-list-heading"
              >
                Material catalogue
              </h2>
              <p className="mt-1 text-sm text-slate-600" aria-live="polite">
                {filteredMaterials.length} of {materials.length} materials
              </p>
            </div>
            <p className="text-sm text-slate-500">Prices shown in {currency}</p>
          </div>

          <div
            className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(14rem,1fr)_12rem_12rem]"
            role="search"
            aria-label="Filter materials"
          >
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              Search
              <input
                className={inputClassName}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Material or supplier"
                type="search"
                value={query}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              Category
              <select
                className={inputClassName}
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                <option value="all">All categories</option>
                {materialCategories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              Stock status
              <select
                className={inputClassName}
                onChange={(event) => setStockStatus(event.target.value)}
                value={stockStatus}
              >
                <option value="all">All stock levels</option>
                {stockStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredMaterials.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No matching materials"
                description="Try a different material name, supplier, category, or stock level."
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
              <MaterialsTable materials={filteredMaterials} />
              <MaterialsCards materials={filteredMaterials} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

function MaterialsTable({
  materials,
}: {
  materials: readonly MaterialSummary[];
}) {
  return (
    <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] border-collapse text-left">
          <caption className="sr-only">
            Materials with supplier, purchase price, stock, and update details
          </caption>
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
            <tr>
              <th className="px-5 py-3" scope="col">
                Material
              </th>
              <th className="px-5 py-3" scope="col">
                Supplier
              </th>
              <th className="px-5 py-3 text-right" scope="col">
                Purchase price
              </th>
              <th className="px-5 py-3 text-right" scope="col">
                Stock
              </th>
              <th className="px-5 py-3" scope="col">
                Last updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {materials.map((material) => (
              <tr className="group hover:bg-slate-50" key={material.id}>
                <th className="px-5 py-4" scope="row">
                  <Link
                    className="font-semibold text-slate-950 underline-offset-4 group-hover:text-emerald-800 group-hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    href={editMaterialHref(material.id)}
                  >
                    {material.name}
                  </Link>
                  <p className="mt-1 text-xs font-normal text-slate-500">
                    {material.category}
                  </p>
                </th>
                <td className="px-5 py-4 text-sm text-slate-700">
                  {material.supplier}
                </td>
                <td className="px-5 py-4 text-right text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">
                    {formatCurrency(
                      material.purchasePrice,
                      material.currencyCode,
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">
                    per{" "}
                    {formatMaterialQuantity(
                      material.packQuantity,
                      material.unit,
                    )}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">
                    {formatMaterialQuantity(
                      material.stockQuantity,
                      material.unit,
                    )}
                  </span>
                  <span className="mt-1 block">
                    <StockBadge status={material.stockStatus} />
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  <time dateTime={material.lastUpdated}>
                    {formatUpdatedDate(material.lastUpdated)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaterialsCards({
  materials,
}: {
  materials: readonly MaterialSummary[];
}) {
  return (
    <ul className="mt-5 grid gap-4 lg:hidden">
      {materials.map((material) => (
        <li
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          key={material.id}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase">
                {material.category}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                <Link
                  className="underline-offset-4 hover:text-emerald-800 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  href={editMaterialHref(material.id)}
                >
                  {material.name}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-slate-600">{material.supplier}</p>
            </div>
            <StockBadge status={material.stockStatus} />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
            <div>
              <dt className="text-xs font-medium text-slate-500">
                Purchase price
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950">
                {formatCurrency(material.purchasePrice, material.currencyCode)}
                <span className="block font-normal text-slate-500">
                  per{" "}
                  {formatMaterialQuantity(material.packQuantity, material.unit)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">
                Available stock
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950">
                {formatMaterialQuantity(material.stockQuantity, material.unit)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-slate-500">
                Last updated
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                <time dateTime={material.lastUpdated}>
                  {formatUpdatedDate(material.lastUpdated)}
                </time>
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function StockBadge({ status }: { status: MaterialStockStatus }) {
  const colorClassName = {
    "In stock": "bg-emerald-100 text-emerald-900",
    "Low stock": "bg-amber-100 text-amber-900",
    "Out of stock": "bg-red-100 text-red-900",
  }[status];

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${colorClassName}`}
    >
      {status}
    </span>
  );
}

function editMaterialHref(materialId: string) {
  return routes.editMaterial.replace("[materialId]", materialId);
}

function formatUpdatedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
