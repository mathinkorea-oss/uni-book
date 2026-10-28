import {
  type CategoryCode,
  normalizeCategoryCode,
} from "@/lib/categories";

export type ClassifyResult = {
  code: CategoryCode;
  needsReview: boolean;
  source: "rule" | "ai" | "default";
};

const MARKETPLACE_ONLY = /^(쿠팡|네이버|11번가|G마켓|옥션|마켓컬리)/i;

function ctx(description: string, note: string) {
  return `${description} ${note}`.replace(/\s+/g, " ").trim();
}

export function classifyByRules(
  description: string,
  note = "",
): ClassifyResult | null {
  const text = ctx(description, note).toLowerCase();
  if (!text) return null;

  if (/개인용|사적|본인용/.test(text) && !/접대|거래처/.test(text)) {
    return { code: "personal_items", needsReview: false, source: "rule" };
  }
  if (/접대|거래처|회식|접견/.test(text)) {
    return { code: "entertainment", needsReview: false, source: "rule" };
  }
  if (/학생\s*간식|간식|햄버거|피자|도시락/.test(text) && /학생/.test(text)) {
    return { code: "student_snack", needsReview: false, source: "rule" };
  }
  if (/점심|저녁|식사|밥|식대|음식/.test(text) && !/접대/.test(text)) {
    return { code: "meal", needsReview: false, source: "rule" };
  }
  if (/교보문고|서점|문구|도서|책|노트/.test(text)) {
    return { code: "books_stationery", needsReview: false, source: "rule" };
  }
  if (/문제은행|학습도구|수학.*(도구|프로그램)|이루마|콴다/.test(text)) {
    return { code: "math_tools", needsReview: false, source: "rule" };
  }
  if (/chatgpt|openai|claude|gemini|ai\s*서비스|구독료/.test(text)) {
    return { code: "ai_service", needsReview: false, source: "rule" };
  }
  if (/주유|교통|택시|주차|차량|톨게이트/.test(text)) {
    return { code: "transport", needsReview: false, source: "rule" };
  }
  if (/골프|그린피|cc\b/.test(text)) {
    return { code: "golf", needsReview: false, source: "rule" };
  }
  if (/여행|숙박|항공|호텔|펜션/.test(text)) {
    return { code: "travel", needsReview: false, source: "rule" };
  }
  if (/광고|홍보|마케팅|배너/.test(text)) {
    return { code: "promotion", needsReview: false, source: "rule" };
  }
  if (/강사.*(구인|채용)|채용\s*공고|잡코리아|사람인/.test(text)) {
    return { code: "instructor_hiring", needsReview: false, source: "rule" };
  }
  if (/청소|비품|학원.*(비품|용품)|화장지|휴지/.test(text)) {
    return { code: "academy_supplies", needsReview: false, source: "rule" };
  }

  const descTrim = description.trim();
  if (MARKETPLACE_ONLY.test(descTrim) && descTrim.length < 20) {
    return { code: "other", needsReview: true, source: "rule" };
  }
  if (/^\S+\s+[\d,]+원?$/.test(descTrim) && !/[가-힣]{3,}/.test(descTrim)) {
    return { code: "other", needsReview: true, source: "rule" };
  }

  return null;
}

export function resolveCategory(
  description: string,
  note: string,
  aiCode?: string | null,
): ClassifyResult {
  const ruled = classifyByRules(description, note);
  if (ruled) return ruled;

  if (aiCode && normalizeCategoryCode(aiCode) !== "other") {
    return {
      code: normalizeCategoryCode(aiCode),
      needsReview: false,
      source: "ai",
    };
  }

  return { code: "other", needsReview: true, source: "default" };
}
