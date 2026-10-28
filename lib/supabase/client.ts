import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}

/** Browser singleton (client components only). */
export const supabase = createClient();

export type ExpenseRow = {
  id: string;
  created_at: string;
  date: string;
  amount: number;
  description: string;
  user_id?: string | null;
  note?: string | null;
  category_code?: string | null;
  category_needs_review?: boolean | null;
  category_user_set?: boolean | null;
  sort_order?: number | null;
};

export const EXPENSE_SELECT =
  "id, created_at, date, amount, description, user_id, note, category_code, category_needs_review, category_user_set, sort_order";
