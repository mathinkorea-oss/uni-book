import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export type ExpenseStatsRow = {
  date: string;
  amount: number;
  description: string;
  note: string | null;
  category_code: string | null;
  card_id?: string | null;
};

export type ExpenseStatsQuery = {
  start?: string;
  end?: string;
  cardId?: string | null;
  categoryCode?: string | null;
};

export async function fetchAllExpensesForStats(
  supabase: SupabaseClient,
  query: ExpenseStatsQuery = {},
): Promise<{ rows: ExpenseStatsRow[]; error: string | null }> {
  const rows: ExpenseStatsRow[] = [];
  let from = 0;

  while (true) {
    let q = supabase
      .from("expenses")
      .select("date, amount, description, note, category_code, card_id")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (query.start) q = q.gte("date", query.start);
    if (query.end) q = q.lte("date", query.end);
    if (query.cardId) q = q.eq("card_id", query.cardId);
    if (query.categoryCode) q = q.eq("category_code", query.categoryCode);

    const { data, error } = await q.range(from, from + PAGE - 1);

    if (error) {
      return { rows: [], error: error.message };
    }
    if (!data?.length) break;
    rows.push(...(data as ExpenseStatsRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return { rows, error: null };
}