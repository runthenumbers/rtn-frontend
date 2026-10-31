"use client";
import { useEffect, useState } from "react";
import { subscribeWorkspaceChanges } from "./changes";
export function useWorkspaceRevision(workspaceId?: string) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!workspaceId) return;
    return subscribeWorkspaceChanges(
      workspaceId,
      ["materials", "batches"],
      () => setRevision((value) => value + 1),
    );
  }, [workspaceId]);
  return revision;
}
