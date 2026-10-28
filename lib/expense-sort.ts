import type { ExpenseRow } from "@/lib/supabase/client";

export type SortMode = "date" | "manual";

export function sortExpenses(
  entries: ExpenseRow[],
  mode: SortMode,
): ExpenseRow[] {
  const copy = [...entries];
  if (mode === "date") {
    copy.sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) return d;
      return b.created_at.localeCompare(a.created_at);
    });
    return copy;
  }
  copy.sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return b.date.localeCompare(a.date);
  });
  return copy;
}

export function buildReorderPayload(ordered: ExpenseRow[]) {
  return ordered.map((row, index) => ({
    id: row.id,
    sort_order: index,
  }));
}
