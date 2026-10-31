"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  notifyWorkspaceChange,
  subscribeWorkspaceChanges,
} from "@/lib/workspace/changes";
import { useAuth, useWorkspace } from "@/components/auth/auth-provider";
import { listMaterials, MaterialError } from "@/lib/materials/api";
import type { MaterialSummary } from "@/lib/materials/types";

type MaterialsState = {
  status: "loading" | "ready" | "error";
  items: readonly MaterialSummary[];
};
interface MaterialsContextValue extends MaterialsState {
  retry: () => void;
  saved: (material: MaterialSummary) => void;
}
const MaterialsContext = createContext<MaterialsContextValue | null>(null);

export function MaterialsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const workspace = useWorkspace();
  return (
    <WorkspaceMaterialsProvider
      key={`${user?.id}:${workspace?.id}`}
      workspaceId={workspace?.id}
    >
      {children}
    </WorkspaceMaterialsProvider>
  );
}
function WorkspaceMaterialsProvider({
  children,
  workspaceId,
}: {
  children: ReactNode;
  workspaceId?: string;
}) {
  const { refresh } = useAuth();
  const [state, setState] = useState<MaterialsState>({
    status: "loading",
    items: [],
  });
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();
  const active =
    pathname.startsWith("/materials") || pathname.startsWith("/batches/");
  const sequence = useRef(0);
  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    setAttempt((current) => current + 1);
  }, []);
  useEffect(() => {
    if (!workspaceId || !active) return;
    const controller = new AbortController();
    const current = ++sequence.current;
    void listMaterials(workspaceId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted && current === sequence.current)
          setState({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || current !== sequence.current) return;
        setState({ status: "error", items: [] });
        if (
          error instanceof MaterialError &&
          (error.status === 401 || error.status === 404)
        )
          void refresh().catch(() => undefined);
      });
    return () => controller.abort();
  }, [workspaceId, attempt, refresh, active, pathname]);
  useEffect(() => {
    if (!workspaceId) return;
    return subscribeWorkspaceChanges(workspaceId, ["materials"], () => {
      ++sequence.current;
      // Keep mounted editors and unfinished builder inputs during background refresh.
      setAttempt((value) => value + 1);
    });
  }, [workspaceId]);
  const saved = useCallback(
    (material: MaterialSummary) => {
      if (material.workspaceId !== workspaceId) return;
      ++sequence.current;
      setState((current) => ({
        status: "ready",
        items: current.items.some((item) => item.id === material.id)
          ? current.items.map((item) =>
              item.id === material.id ? material : item,
            )
          : [material, ...current.items],
      }));
      notifyWorkspaceChange(workspaceId, "materials");
      // Reconcile the full catalogue, including records missing from an in-flight initial load.
      setAttempt((current) => current + 1);
    },
    [workspaceId],
  );
  return (
    <MaterialsContext.Provider value={{ ...state, retry, saved }}>
      {children}
    </MaterialsContext.Provider>
  );
}
export function useMaterials(): MaterialsContextValue {
  const value = useContext(MaterialsContext);
  if (!value) throw new Error("MaterialsProvider is required");
  return value;
}
