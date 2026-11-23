import { isCategoryCode, normalizeCategoryCode } from "@/lib/categories";
import type { SupabaseClient } from "@supabase/supabase-js";

/** DB에 등록된 분류만, is_active=true일 때만 선택 가능 (builtin 비활성도 거부) */
export function categorySelectableFromRow(
  row: { is_active: boolean } | null,
): { ok: true } | { ok: false; message: string } {
  if (!row) {
    return {
      ok: false,
      message: "분류 목록을 불러온 뒤 다시 선택해 주세요.",
    };
  }
  if (!row.is_active) {
    return {
      ok: false,
      message: "사용 중지된 분류는 새로 선택할 수 없습니다.",
    };
  }
  return { ok: true };
}

export async function resolveUserCategoryCode(
  supabase: SupabaseClient,
  userId: string,
  raw: string | null | undefined,
): Promise<string> {
  const code = (raw ?? "").trim();
  if (!code) return "other";
  if (isCategoryCode(code)) return code;

  const { data } = await supabase
    .from("user_expense_categories")
    .select("code")
    .eq("user_id", userId)
    .eq("code", code)
    .maybeSingle();

  if (data?.code) return data.code;
  return normalizeCategoryCode(code);
}

/** 분류 변경 시: 활성 분류·기본 코드만 허용 */
export async function resolveSelectableCategoryCode(
  supabase: SupabaseClient,
  userId: string,
  raw: string | null | undefined,
): Promise<
  { ok: true; code: string } | { ok: false; message: string }
> {
  const code = (raw ?? "").trim();
  if (!code) {
    return { ok: false, message: "분류를 선택해 주세요." };
  }

  const { data } = await supabase
    .from("user_expense_categories")
    .select("code, is_active")
    .eq("user_id", userId)
    .eq("code", code)
    .maybeSingle();

  const check = categorySelectableFromRow(data);
  if (!check.ok) {
    return check;
  }
  if (data?.code) {
    return { ok: true, code: data.code };
  }

  return { ok: false, message: "유효하지 않은 분류입니다." };
}