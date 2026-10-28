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
  const channel = useRef<BroadcastChannel | null>(null);
  const sequence = useRef(0);
  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    setAttempt((current) => current + 1);
  }, []);
  useEffect(() => {
    if (!workspaceId) return;
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
  }, [workspaceId, attempt, refresh]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined" || !workspaceId) return;
    const connection = new BroadcastChannel(`rtn-batches:${workspaceId}`);
    channel.current = connection;
    const revalidate = () => setAttempt((current) => current + 1);
    connection.onmessage = revalidate;
    window.addEventListener("focus", revalidate);
    return () => {
      channel.current = null;
      window.removeEventListener("focus", revalidate);
      connection.close();
    };
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
      channel.current?.postMessage("batches-changed");
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
