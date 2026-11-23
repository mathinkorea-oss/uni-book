import { CATEGORY_LABELS, type CategoryCode, isCategoryCode } from "@/lib/categories";
import { BACKFILL_LEGACY_KEYS } from "@/lib/backfill-categories";

export type UserCategoryRow = {
  id: string;
  user_id: string;
  code: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
  is_builtin: boolean;
};

export const CUSTOM_CATEGORY_CODE_RE = /^custom_[a-z0-9_]{4,63}$/;

export function isCustomCategoryCode(code: string): boolean {
  return CUSTOM_CATEGORY_CODE_RE.test(code);
}

/** 사용자가 추가하는 분류 코드 검증 (기본 code 선점 금지) */
export function validateUserCategoryInsertCode(code: string):
  | { ok: true }
  | { ok: false; message: string } {
  if (isCategoryCode(code)) {
    return {
      ok: false,
      message: "기본 분류 코드는 사용자 분류로 등록할 수 없습니다.",
    };
  }
  if (!isCustomCategoryCode(code)) {
    return {
      ok: false,
      message: "사용자 분류 코드는 custom_ 접두사 형식이어야 합니다.",
    };
  }
  return { ok: true };
}

export function isValidNewCategoryName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 40;
}

export function resolveCategoryLabel(
  code: string | null | undefined,
  categories: UserCategoryRow[],
): string {
  const raw = code ?? "other";
  const row = categories.find((c) => c.code === raw);
  if (row) return row.display_name;
  if (isCategoryCode(raw)) return CATEGORY_LABELS[raw as CategoryCode];
  if (BACKFILL_LEGACY_KEYS.has(raw)) return `${raw} (레거시)`;
  if (isCustomCategoryCode(raw)) return raw;
  return raw;
}

/** 필터·통계: 비활성 포함 전체 */
export function categoriesForFilter(
  categories: UserCategoryRow[],
): UserCategoryRow[] {
  return [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name, "ko"),
  );
}

/** 신규 입력·수정 선택: 활성만 */
export function categoriesForPicker(
  categories: UserCategoryRow[],
): UserCategoryRow[] {
  return categoriesForFilter(categories).filter((c) => c.is_active);
}

/** 분류 마스터에 없고 지출에만 있는 코드 (미등록) */
export function isUnregisteredCategoryRow(row: UserCategoryRow): boolean {
  return row.id.startsWith("synthetic-") || row.user_id === "";
}

export function formatCategoryFilterSuffix(row: UserCategoryRow): string {
  if (isUnregisteredCategoryRow(row)) return " (미등록)";
  if (!row.is_active) return " (중지)";
  return "";
}

function preferMasterCategoryRow(
  a: UserCategoryRow,
  b: UserCategoryRow,
): UserCategoryRow {
  if (a.user_id && !b.user_id) return a;
  if (b.user_id && !a.user_id) return b;
  if (a.is_builtin && !b.is_builtin) return a;
  if (b.is_builtin && !a.is_builtin) return b;
  return a;
}

function syntheticCategoryRow(code: string, sortIndex: number): UserCategoryRow {
  let display_name = code;
  if (isCategoryCode(code)) {
    display_name = CATEGORY_LABELS[code as CategoryCode];
  } else if (BACKFILL_LEGACY_KEYS.has(code)) {
    display_name = `${code} (레거시)`;
  }
  return {
    id: `synthetic-${code}`,
    user_id: "",
    code,
    display_name,
    sort_order: 9000 + sortIndex,
    is_active: false,
    is_builtin: isCategoryCode(code),
  };
}

export function mergeCategoryOptions(
  categories: UserCategoryRow[],
  expenseCodes: string[],
): UserCategoryRow[] {
  const byCode = new Map<string, UserCategoryRow>();

  for (const row of categories) {
    const existing = byCode.get(row.code);
    if (!existing) {
      byCode.set(row.code, row);
      continue;
    }
    byCode.set(row.code, preferMasterCategoryRow(existing, row));
  }

  const seenExp = new Set<string>();
  const orphanCodes: string[] = [];
  for (const raw of expenseCodes) {
    const code = (raw ?? "other").trim() || "other";
    if (seenExp.has(code) || byCode.has(code)) continue;
    seenExp.add(code);
    orphanCodes.push(code);
  }

  orphanCodes.forEach((code, i) => {
    byCode.set(code, syntheticCategoryRow(code, i));
  });

  return categoriesForFilter([...byCode.values()]);
}