import { getCategoryLabel, isCategoryCode } from "@/lib/categories";
import type { ChatMessageInput } from "@/lib/gemini-expense";

export type ExpenseForStats = {
  date: string;
  amount: number;
  description: string;
  note?: string | null;
  category_code?: string | null;
};

export function formatExpensesForStats(rows: ExpenseForStats[]): string {
  if (!rows.length) return "(저장된 지출 없음)";

  return rows
    .map((r) => {
      const cat = isCategoryCode(r.category_code ?? "")
        ? getCategoryLabel(r.category_code!)
        : getCategoryLabel("other");
      const note = r.note?.trim() ? ` | 참고:${r.note.trim()}` : "";
      return `${r.date}\t${r.amount}\t${cat}\t${r.description}${note}`;
    })
    .join("\n");
}

export function buildStatsAnswerPrompt(
  today: string,
  expenseTable: string,
  expenseCount: number,
  messages: ChatMessageInput[],
) {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n");

  return `오늘 날짜: ${today}

당신은 UNITHE 법카노트의 친근한 가계부 도우미입니다.
아래는 사용자 본인의 법인카드 지출 전체 목록입니다(탭 구분: 날짜, 금액(원), 분류, 사용내용).
총 ${expenseCount}건입니다. 목록에 없는 금액·날짜·항목은 지어내지 마세요.

지출 목록:
${expenseTable}

규칙:
- 사용자의 마지막 질문에만 답합니다. "이번 달", "지난주", "어제" 등은 오늘(${today}) 기준으로 해석합니다.
- 식비는 분류가 식사·간식(meal, student_snack)에 해당하는 지출을 합산해 설명할 수 있습니다.
- 금액은 한국어로 읽기 쉽게 (예: 26,500원) 표기합니다.
- 데이터가 없거나 해당 기간·조건에 기록이 없으면 솔직히 알려 주세요.
- 2~5문장 정도로 자연스럽고 따뜻한 말투로 답합니다. JSON이 아니라 평문만 출력합니다.

대화:
${transcript}

답변:`;
}
