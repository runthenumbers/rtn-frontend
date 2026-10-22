// Preview business data is separate from the authenticated server session.
let userId: string | null = null;
export function setPreviewUser(id: string | null): void {
  userId = id;
}
export function previewStorageKey(key: string): string {
  return `${key}:user:${userId ?? "guest"}`;
}
