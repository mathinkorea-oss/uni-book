import { NextResponse } from "next/server";
import { mapLegacyCategoryName, normalizeCategoryCode } from "@/lib/categories";
import { classifyByRules, resolveCategory } from "@/lib/classify-expense";
import { expenseTextParts } from "@/lib/expense-parse";
import { EXPENSE_SELECT, type ExpenseRow } from "@/lib/supabase/client";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

const LEGACY_KEYS = new Set([
  "서점(책)_노트",
  "수학프로그램(학습도구)",
  "AI",
  "강사_구인",
  "교통(차량)",
  "개인_접대",
  "개인/접대",
]);

export async function POST() {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .eq("category_user_set", false)
    .limit(500);

  if (error) {
    return NextResponse.json(
      { error: "내역을 불러오지 못했습니다. 마이그레이션을 확인해 주세요." },
      { status: 500 },
    );
  }

  let updated = 0;
  for (const row of (data ?? []) as ExpenseRow[]) {
    const { main, note } = expenseTextParts(row);
    let code = normalizeCategoryCode(row.category_code);
    let needsReview = Boolean(row.category_needs_review);

    if (row.category_code && LEGACY_KEYS.has(row.category_code)) {
      code = mapLegacyCategoryName(row.category_code, main, note ?? "");
      needsReview = code === "other";
    } else {
      const ruled = classifyByRules(main, note ?? "");
      const resolved = ruled ?? resolveCategory(main, note ?? "");
      code = resolved.code;
      needsReview = resolved.needsReview;
    }

    const { error: upErr } = await supabase
      .from("expenses")
      .update({
        category_code: code,
        category_needs_review: needsReview,
      })
      .eq("id", row.id)
      .eq("category_user_set", false);

    if (!upErr) updated += 1;
  }

  return NextResponse.json({ updated });
}
