"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { loadCatalogues, type Catalogues } from "@/lib/catalogues/api";
import { ErrorState, LoadingState } from "../ui/feedback";

type CatalogueState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: Catalogues };

const CataloguesContext = createContext<Catalogues | null>(null);

export function CataloguesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CatalogueState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await loadCatalogues(controller.signal);
        if (!controller.signal.aborted) {
          setState({ status: "ready", data });
        }
      } catch {
        if (!controller.signal.aborted) {
          controller.abort();
          setState({ status: "error" });
        }
      }
    }
    void load();

    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  if (state.status === "loading") {
    return <LoadingState label="Loading currencies and measurement units" />;
  }

  if (state.status === "error") {
    return (
      <ErrorState
        title="Unable to load currencies and units"
        description="Check your connection and try again."
        action={
          <button
            type="button"
            onClick={retry}
            className="rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Try again
          </button>
        }
      />
    );
  }
  return (
    <CataloguesContext.Provider value={state.data}>
      {children}
    </CataloguesContext.Provider>
  );
}

export function useCatalogues(): Catalogues {
  const catalogues = useContext(CataloguesContext);

  if (catalogues === null) {
    throw new Error("useCatalogues requires CataloguesProvider.");
  }

  return catalogues;
}
