import type { Metadata } from "next";

import { BusinessSettingsForm } from "@/components/settings/business-settings-form";

export const metadata: Metadata = {
  title: "Settings",
  description: "View the active RTN business profile and currency preferences.",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <header>
        <p className="text-sm font-bold tracking-[0.12em] text-emerald-800 uppercase">
          Workspace
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
          Settings
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          View the saved business details and currency preferences for your
          active workspace.
        </p>
      </header>
      <div className="mt-8">
        <BusinessSettingsForm />
      </div>
    </div>
  );
}
