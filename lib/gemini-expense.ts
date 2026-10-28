export type ExpenseAnalysis = {
  action: "save" | "need_info" | "conversation";
  date: string | null;
  amount: number | null;
  description: string | null;
  note?: string | null;
  category_code?: string | null;
  reply: string;
};

export type ChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatSavedMessage(
  date: string,
  description: string,
  amount: number,
  categoryLabel?: string,
  needsReview?: boolean,
) {
  const [, month, day] = date.split("-");
  const formatted = new Intl.NumberFormat("ko-KR").format(amount);
  let msg = `${Number(month)}월 ${Number(day)}일 ${description} ${formatted}원을 저장했어요!`;
  if (categoryLabel) {
    msg += `\n분류: ${categoryLabel}`;
    if (needsReview) msg += " · 분류 확인 필요";
  }
  return msg;
}

export function parseExpenseAnalysis(raw: string): ExpenseAnalysis | null {
  try {
    const parsed = JSON.parse(raw) as ExpenseAnalysis;
    if (
      !parsed ||
      typeof parsed.reply !== "string" ||
      !["save", "need_info", "conversation"].includes(parsed.action)
    ) {
      return null;
    }
    return {
      action: parsed.action,
      date: parsed.date ?? null,
      amount:
        typeof parsed.amount === "number" && !Number.isNaN(parsed.amount)
          ? Math.round(parsed.amount)
          : null,
      description: parsed.description?.trim() || null,
      note: parsed.note?.trim() || null,
      category_code: parsed.category_code?.trim() || null,
      reply: parsed.reply.trim(),
    };
  } catch {
    return null;
  }
}

export function isValidExpense(
  analysis: ExpenseAnalysis,
): analysis is ExpenseAnalysis & {
  date: string;
  amount: number;
  description: string;
} {
  return (
    analysis.action === "save" &&
    Boolean(analysis.date) &&
    typeof analysis.amount === "number" &&
    analysis.amount > 0 &&
    Boolean(analysis.description)
  );
}

export function buildAnalysisPrompt(
  today: string,
  recentExpenses: string,
  messages: ChatMessageInput[],
) {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n");

  return `오늘 날짜: ${today}

당신은 가계부 지출 분석기입니다. 대화를 읽고 반드시 JSON만 출력합니다.

규칙:
- 통계·조회 질문(얼마 썼어, 뭐 샀더라, 가장 많이 쓴 항목 등)은 이 JSON 분석 대상이 아닙니다. 지출을 새로 적으려는 경우만 처리합니다.
- 지출 기록 의도가 있으면 action을 "save"로 설정합니다.
- 날짜(YYYY-MM-DD), 금액(원, 정수), description(지출 내용), note(참고, 없으면 null)을 추출합니다.
- category_code는 meal, student_snack, books_stationery, math_tools, academy_supplies, promotion, instructor_hiring, ai_service, transport, golf, travel, entertainment, personal_items, other 중 하나 또는 null(불확실).
- 쿠팡·네이버 등 상호만으로 분류를 확정하지 말고 null로 두세요.
- "어제", "오늘", "지난주 금요일" 등은 오늘 날짜(${today}) 기준으로 계산합니다.
- 금액이 "2만원", "15000원" 등이면 숫자(20000, 15000)로 변환합니다.
- 날짜 또는 금액을 확실히 알 수 없으면 action을 "need_info"로 하고 reply에서 무엇이 필요한지 한국어로 질문합니다.
- 지출과 무관한 일반 대화면 action을 "conversation"으로 합니다.
- save일 때 reply는 저장 전 확인용 한국어 한 문장(친근한 톤)으로 작성합니다. 저장 성공 문구는 서버에서 다시 작성하므로 간단히 해도 됩니다.

JSON 스키마:
{
  "action": "save" | "need_info" | "conversation",
  "date": string | null,
  "amount": number | null,
  "description": string | null,
  "note": string | null,
  "category_code": string | null,
  "reply": string
}

최근 저장 지출:
${recentExpenses || "(없음)"}

대화:
${transcript}`;
}
