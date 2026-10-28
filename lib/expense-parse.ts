import type { ExpenseRow } from "@/lib/supabase/client";

const EXPENSE_PATTERN =
  /\|\|\|EXPENSE\|\|\|(\{[\s\S]*?\})\|\|\|END\|\|\|/;

export type ParsedExpensePayload = {
  date: string;
  amount: number;
  description: string;
  note?: string;
};

export function extractExpenseFromReply(text: string): {
  visibleReply: string;
  expense: ParsedExpensePayload | null;
} {
  const match = text.match(EXPENSE_PATTERN);
  if (!match) {
    return { visibleReply: text.trim(), expense: null };
  }

  const visibleReply = text.replace(EXPENSE_PATTERN, "").trim();

  try {
    const raw = JSON.parse(match[1]) as ParsedExpensePayload;
    if (
      !raw.date ||
      typeof raw.amount !== "number" ||
      raw.amount <= 0 ||
      !raw.description?.trim()
    ) {
      return { visibleReply: text.replace(EXPENSE_PATTERN, "").trim(), expense: null };
    }
    return {
      visibleReply,
      expense: {
        date: String(raw.date),
        amount: Math.round(raw.amount),
        description: raw.description.trim(),
        note: raw.note?.trim() || "",
      },
    };
  } catch {
    return { visibleReply: text.replace(EXPENSE_PATTERN, "").trim(), expense: null };
  }
}

export function descriptionForDb(description: string, note: string) {
  const main = description.trim();
  const extra = note.trim();
  if (!extra) return main;
  return `${main} (${extra})`;
}

export function splitDescription(desc: string) {
  const match = desc.match(/^(.+?) \((.+)\)$/);
  if (match) return { main: match[1], note: match[2] };
  return { main: desc, note: undefined };
}

export function expenseTextParts(row: ExpenseRow) {
  const noteFromCol = row.note?.trim();
  if (noteFromCol) {
    return { main: row.description, note: noteFromCol };
  }
  return splitDescription(row.description);
}
