import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserCategoryRow } from "@/lib/user-categories";

export async function ensureUserCategories(
  supabase: SupabaseClient,
): Promise<{ categories: UserCategoryRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("ensure_user_expense_categories");
  if (error) {
    return { categories: [], error: error.message };
  }
  return { categories: (data ?? []) as UserCategoryRow[], error: null };
}