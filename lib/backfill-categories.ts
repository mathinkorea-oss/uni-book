import { mapLegacyCategoryName, normalizeCategoryCode } from "@/lib/categories";
import { classifyByRules, resolveCategory } from "@/lib/classify-expense";
import { expenseTextParts } from "@/lib/expense-parse";
import type { ExpenseRow } from "@/lib/supabase/client";

export const BACKFILL_LEGACY_KEYS = new Set([
  "서점(책)_노트",
  "수학프로그램(학습도구)",
  "AI",
  "강사_구인",
  "교통(차량)",
  "개인_접대",
  "개인/접대",
]);

export type BackfillScope = "needs_review_only" | "reapply_rules";

export function isBackfillTarget(
  row: Pick<
    ExpenseRow,
    "category_code" | "category_needs_review" | "category_user_set"
  >,
  scope: BackfillScope,
): boolean {
  if (row.category_user_set) return false;
  if (scope === "reapply_rules") return true;
  if (row.category_needs_review) return true;
  const code = row.category_code ?? "";
  if (normalizeCategoryCode(code) === "other") return true;
  if (BACKFILL_LEGACY_KEYS.has(code)) return true;
  return false;
}

export function classifyExpenseRow(
  row: ExpenseRow,
): { code: string; needsReview: boolean } {
  const { main, note } = expenseTextParts(row);
  let code = normalizeCategoryCode(row.category_code);
  let needsReview = Boolean(row.category_needs_review);

  if (row.category_code && BACKFILL_LEGACY_KEYS.has(row.category_code)) {
    code = mapLegacyCategoryName(row.category_code, main, note ?? "");
    needsReview = code === "other";
  } else {
    const ruled = classifyByRules(main, note ?? "");
    const resolved = ruled ?? resolveCategory(main, note ?? "");
    code = resolved.code;
    needsReview = resolved.needsReview;
  }

  return { code, needsReview };
}