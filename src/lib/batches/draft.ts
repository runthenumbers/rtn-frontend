export interface BatchDraft {
  name: string;
  reference: string;
  date: string;
  outputQuantity: string;
  outputUnit: string;
  notes: string;
  lines: { id: string; materialId: string; quantity: string; unit: string }[];
  fixedCosts: { id: string; name: string; amount: string }[];
}
export function draftKey(userId: string, workspaceId: string): string {
  return `rtn:batch-draft:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceId)}`;
}
export function parseDraft(raw: string | null): BatchDraft | null {
  try {
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      ![
        "name",
        "reference",
        "date",
        "outputQuantity",
        "outputUnit",
        "notes",
      ].every(
        (key) => typeof item[key] === "string" && item[key].length <= 5000,
      )
    )
      return null;
    for (const [key, fields, maximum] of [
      ["lines", ["id", "materialId", "quantity", "unit"], 500],
      ["fixedCosts", ["id", "name", "amount"], 100],
    ] as const) {
      const rows = item[key];
      if (
        !Array.isArray(rows) ||
        rows.length > maximum ||
        !rows.every(
          (row) =>
            row &&
            typeof row === "object" &&
            fields.every(
              (field) =>
                typeof row[field] === "string" && row[field].length <= 5000,
            ),
        ) ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        return null;
    }
    if ((item.lines as unknown[]).length === 0) return null;
    return item as unknown as BatchDraft;
  } catch {
    return null;
  }
}
