import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyExpenseRow, isBackfillTarget, type BackfillScope } from "@/lib/backfill-categories";
import { parseYmd } from "@/lib/expense-period";
import type { CardFilter } from "@/lib/cards";
import { EXPENSE_SELECT, type ExpenseRow } from "@/lib/supabase/client";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

const PAGE = 500;

type PreviewBody = {
  start?: string;
  end?: string;
  cardFilter?: CardFilter;
  scope?: BackfillScope;
};

function parseScope(raw: unknown): BackfillScope {
  return raw === "reapply_rules" ? "reapply_rules" : "needs_review_only";
}

async function loadExpensesInRange(
  supabase: SupabaseClient,
  start: string,
  end: string,
  cardId?: string | null,
): Promise<{ rows: ExpenseRow[]; error: string | null }> {
  const rows: ExpenseRow[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("expenses")
      .select(EXPENSE_SELECT)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (cardId) {
      query = query.eq("card_id", cardId);
    }
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) return { rows: [], error: error.message };
    if (!data?.length) break;
    rows.push(...(data as ExpenseRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { rows, error: null };
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  const cardFilter = (url.searchParams.get("cardFilter") ?? "all") as CardFilter;
  const scope = parseScope(url.searchParams.get("scope"));

  if (!parseYmd(start) || !parseYmd(end) || start > end) {
    return NextResponse.json(
      { error: "조회 기간이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  let cardId: string | null = null;
  if (cardFilter !== "all") {
    const { data: card } = await auth.supabase
      .from("user_cards")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("code", cardFilter)
      .maybeSingle();
    cardId = card?.id ?? null;
  }

  const { rows, error } = await loadExpensesInRange(
    auth.supabase,
    start,
    end,
    cardId,
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const eligible = rows.filter((r) => isBackfillTarget(r, scope));
  const userLocked = rows.filter((r) => r.category_user_set).length;

  return NextResponse.json({
    start,
    end,
    cardFilter,
    scope,
    scopeLabel:
      scope === "reapply_rules"
        ? "이미 분류된 내역도 다시 분류"
        : "분류가 필요한 내역만",
    totalInRange: rows.length,
    targetCount: eligible.length,
    skippedUserSetCount: userLocked,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  let body: PreviewBody & { confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const start = body.start?.trim() ?? "";
  const end = body.end?.trim() ?? "";
  const cardFilter = (body.cardFilter ?? "all") as CardFilter;
  const scope = parseScope(body.scope);

  if (!parseYmd(start) || !parseYmd(end) || start > end) {
    return NextResponse.json(
      { error: "조회 기간이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  let cardId: string | null = null;
  if (cardFilter !== "all") {
    const { data: card } = await auth.supabase
      .from("user_cards")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("code", cardFilter)
      .maybeSingle();
    cardId = card?.id ?? null;
  }

  const { rows, error } = await loadExpensesInRange(
    auth.supabase,
    start,
    end,
    cardId,
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  let updated = 0;

  for (const row of rows) {
    if (row.date < start || row.date > end) continue;
    if (cardId && row.card_id !== cardId) continue;
    if (row.category_user_set) continue;
    if (!isBackfillTarget(row, scope)) continue;

    const { data: fresh, error: freshErr } = await auth.supabase
      .from("expenses")
      .select("id, category_user_set, category_code, category_needs_review, date, card_id")
      .eq("id", row.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (freshErr || !fresh) continue;
    if (fresh.category_user_set) continue;
    if (fresh.date < start || fresh.date > end) continue;
    if (cardId && fresh.card_id !== cardId) continue;
    if (
      !isBackfillTarget(
        {
          category_code: fresh.category_code,
          category_needs_review: fresh.category_needs_review,
          category_user_set: fresh.category_user_set,
        },
        scope,
      )
    ) {
      continue;
    }

    const classified = classifyExpenseRow(row);
    const { data: touched, error: upErr } = await auth.supabase
      .from("expenses")
      .update({
        category_code: classified.code,
        category_needs_review: classified.needsReview,
      })
      .eq("id", row.id)
      .eq("user_id", auth.user.id)
      .eq("category_user_set", false)
      .select("id");

    if (!upErr && touched?.length) updated += 1;
  }

  const targetCount = rows.filter(
    (r) =>
      !r.category_user_set &&
      r.date >= start &&
      r.date <= end &&
      (!cardId || r.card_id === cardId) &&
      isBackfillTarget(r, scope),
  ).length;

  return NextResponse.json({
    updated,
    targetCount,
    scope,
    start,
    end,
    cardFilter,
  });
}