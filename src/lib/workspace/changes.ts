export type WorkspaceResource = "materials" | "batches";
const eventName = "rtn:workspace-change";
function channelName(workspaceId: string) {
  return `rtn-workspace:${workspaceId}`;
}
function openChannel(workspaceId: string) {
  try {
    return typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel(channelName(workspaceId));
  } catch {
    return undefined;
  }
}
export function notifyWorkspaceChange(
  workspaceId: string,
  resource: WorkspaceResource,
) {
  window.dispatchEvent(
    new CustomEvent(eventName, { detail: { workspaceId, resource } }),
  );
  const channel = openChannel(workspaceId);
  try {
    channel?.postMessage(resource);
  } catch {
    /* Focus and route-entry refresh still work when messaging is blocked. */
  } finally {
    channel?.close();
  }
}
export function subscribeWorkspaceChanges(
  workspaceId: string,
  resources: readonly WorkspaceResource[],
  callback: () => void,
) {
  const local = (event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (
      detail &&
      typeof detail === "object" &&
      "workspaceId" in detail &&
      detail.workspaceId === workspaceId &&
      "resource" in detail &&
      resources.includes(detail.resource as WorkspaceResource)
    )
      callback();
  };
  const channel = openChannel(workspaceId);
  if (channel)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (resources.includes(event.data as WorkspaceResource)) callback();
    };
  window.addEventListener(eventName, local);
  window.addEventListener("focus", callback);
  return () => {
    window.removeEventListener(eventName, local);
    window.removeEventListener("focus", callback);
    channel?.close();
  };
}
