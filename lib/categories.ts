export type CategoryCode =
  | "meal"
  | "student_snack"
  | "books_stationery"
  | "math_tools"
  | "academy_supplies"
  | "promotion"
  | "instructor_hiring"
  | "ai_service"
  | "transport"
  | "golf"
  | "travel"
  | "entertainment"
  | "personal_items"
  | "other";

export type CategoryGroupId =
  | "meal_snack"
  | "books"
  | "operations"
  | "digital"
  | "travel_leisure"
  | "personal"
  | "other";

export const CATEGORY_GROUPS: {
  id: CategoryGroupId;
  label: string;
  codes: CategoryCode[];
}[] = [
  {
    id: "meal_snack",
    label: "식사·간식",
    codes: ["meal", "student_snack"],
  },
  {
    id: "books",
    label: "도서·학습",
    codes: ["books_stationery", "math_tools"],
  },
  {
    id: "operations",
    label: "운영·홍보",
    codes: ["academy_supplies", "promotion", "instructor_hiring"],
  },
  {
    id: "digital",
    label: "디지털 서비스",
    codes: ["ai_service"],
  },
  {
    id: "travel_leisure",
    label: "이동·여가",
    codes: ["transport", "golf", "travel"],
  },
  {
    id: "personal",
    label: "개인·접대",
    codes: ["entertainment", "personal_items"],
  },
  { id: "other", label: "기타", codes: ["other"] },
];

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  meal: "식사",
  student_snack: "학생간식",
  books_stationery: "도서·문구",
  math_tools: "수학 학습도구",
  academy_supplies: "학원비품",
  promotion: "홍보",
  instructor_hiring: "강사 구인",
  ai_service: "AI 서비스",
  transport: "교통·차량",
  golf: "골프",
  travel: "여행",
  entertainment: "접대",
  personal_items: "개인물품",
  other: "기타",
};

const LEGACY_LABEL_MAP: Record<string, CategoryCode> = {
  "서점(책)_노트": "books_stationery",
  "수학프로그램(학습도구)": "math_tools",
  AI: "ai_service",
  강사_구인: "instructor_hiring",
  "교통(차량)": "transport",
};

export function isCategoryCode(value: string): value is CategoryCode {
  return value in CATEGORY_LABELS;
}

export function normalizeCategoryCode(
  raw: string | null | undefined,
): CategoryCode {
  if (!raw) return "other";
  if (isCategoryCode(raw)) return raw;
  const legacy = LEGACY_LABEL_MAP[raw];
  if (legacy) return legacy;
  return "other";
}

export function getCategoryLabel(code: string | null | undefined): string {
  const c = normalizeCategoryCode(code ?? "other");
  return CATEGORY_LABELS[c];
}

/** 개인_접대 등 애매한 레거시: 문맥으로 제안 */
export function mapLegacyCategoryName(
  legacy: string,
  description: string,
  note: string,
): CategoryCode {
  if (legacy === "개인_접대" || legacy === "개인/접대") {
    const ctx = `${description} ${note}`.toLowerCase();
    if (/접대|거래처|회식|접견/.test(ctx)) return "entertainment";
    if (/개인|사적|본인/.test(ctx)) return "personal_items";
    return "other";
  }
  return normalizeCategoryCode(LEGACY_LABEL_MAP[legacy] ?? legacy);
}
