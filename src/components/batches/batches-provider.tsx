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
import { listBatches, BatchError } from "@/lib/batches/api";
import type { Batch } from "@/lib/batches/types";

type BatchesState = {
  status: "loading" | "ready" | "error";
  items: readonly Batch[];
};
interface BatchesContextValue extends BatchesState {
  retry: () => void;
  saved: (batch: Batch) => void;
}
const BatchesContext = createContext<BatchesContextValue | null>(null);

export function BatchesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const workspace = useWorkspace();
  return (
    <WorkspaceBatchesProvider
      key={`${user?.id}:${workspace?.id}`}
      workspaceId={workspace?.id}
    >
      {children}
    </WorkspaceBatchesProvider>
  );
}
function WorkspaceBatchesProvider({
  children,
  workspaceId,
}: {
  children: ReactNode;
  workspaceId?: string;
}) {
  const { refresh } = useAuth();
  const [state, setState] = useState<BatchesState>({
    status: "loading",
    items: [],
  });
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();
  const active = pathname.startsWith("/batches");
  const sequence = useRef(0);
  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    setAttempt((current) => current + 1);
  }, []);
  useEffect(() => {
    if (!workspaceId || !active) return;
    const controller = new AbortController();
    const current = ++sequence.current;
    void listBatches(workspaceId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted && current === sequence.current)
          setState({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || current !== sequence.current) return;
        setState({ status: "error", items: [] });
        if (
          error instanceof BatchError &&
          (error.status === 401 || error.status === 404)
        )
          void refresh().catch(() => undefined);
      });
    return () => controller.abort();
  }, [workspaceId, attempt, refresh, active, pathname]);
  useEffect(() => {
    if (!workspaceId) return;
    return subscribeWorkspaceChanges(
      workspaceId,
      ["materials", "batches"],
      () => {
        ++sequence.current;
        setState((current) => ({ ...current, status: "loading" }));
        setAttempt((value) => value + 1);
      },
    );
  }, [workspaceId]);
  const saved = useCallback(
    (batch: Batch) => {
      if (batch.workspaceId !== workspaceId) return;
      ++sequence.current;
      setState((current) => ({
        status: "ready",
        items: current.items.some((item) => item.id === batch.id)
          ? current.items.map((item) => (item.id === batch.id ? batch : item))
          : [batch, ...current.items],
      }));
      notifyWorkspaceChange(workspaceId, "batches");
      // Reconcile the full catalogue, including records missing from an in-flight initial load.
      setAttempt((current) => current + 1);
    },
    [workspaceId],
  );
  return (
    <BatchesContext.Provider value={{ ...state, retry, saved }}>
      {children}
    </BatchesContext.Provider>
  );
}
export function useBatches(): BatchesContextValue {
  const value = useContext(BatchesContext);
  if (!value) throw new Error("BatchesProvider is required");
  return value;
}
