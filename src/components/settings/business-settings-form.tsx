"use client";

import { useAuth, useWorkspace } from "@/components/auth/auth-provider";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { businessTypes, countries } from "@/lib/domain/business-options";

export function BusinessSettingsForm() {
  const { status } = useAuth();
  const workspace = useWorkspace();

  if (status === "loading") {
    return <LoadingState label="Loading business settings" />;
  }
  if (!workspace) {
    return (
      <ErrorState
        title="Business profile unavailable"
        description="We couldn't load your business profile. Please refresh your session and try again."
      />
    );
  }

  const businessType =
    businessTypes.find((option) => option.value === workspace.businessType)
      ?.label ??
    workspace.businessType ??
    "Not specified";
  const country =
    countries.find((option) => option.value === workspace.country)?.label ??
    workspace.country ??
    "Not specified";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your saved business profile is currently read-only.
        </p>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          {[
            ["Business name", workspace.businessName],
            ["Business type", businessType],
            ["Country or region", country],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm font-medium text-slate-600">{label}</dt>
              <dd className="mt-1 text-base break-words text-slate-950">
                {value}
              </dd>
            </div>
          ))}
        </dl>
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
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-600">
              Base currency
            </dt>
            <dd className="mt-1 text-base text-slate-950">
              {workspace.baseCurrency}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-600">
              Secondary currency
            </dt>
            <dd className="mt-1 text-base text-slate-950">
              {workspace.secondaryCurrency ?? "None"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
