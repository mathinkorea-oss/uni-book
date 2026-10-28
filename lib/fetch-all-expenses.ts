import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export type ExpenseStatsRow = {
  date: string;
  amount: number;
  description: string;
  note: string | null;
  category_code: string | null;
};

export async function fetchAllExpensesForStats(
  supabase: SupabaseClient,
): Promise<{ rows: ExpenseStatsRow[]; error: string | null }> {
  const rows: ExpenseStatsRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("expenses")
      .select("date, amount, description, note, category_code")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);

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
