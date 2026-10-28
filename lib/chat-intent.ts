/**
 * 지출 기록 vs 통계·질문 구분 (마지막 사용자 메시지 기준)
 * - 구체적 금액 + 지출 기록 의도 → expense
 * - 의문사·통계 표현 → stats
 */
export function classifyChatIntent(text: string): "stats" | "expense" {
  const t = text.trim().replace(/\s+/g, " ");

  const endsWithQuestion = /[?？]$/.test(t);
  const hasQuestionWord =
    /(얼마|무엇|어떻게|어디|언제|몇\s?(건|번|일|원)?|가장|제일|많이\s?(쓴|썼|지출)|적게|총\s?(지출|금액|합|액)|합계|통계|알려\s?줘|알려줘|샀더라|썼더라|기억|정리|뭐\s?(샀|썼|지출)|뭘\s?(샀|썼))/.test(
      t,
    );

  const hasPurchaseAmount =
    /(\d[\d,]*\s*(원|만\s?원|천\s?원)|\d+\s*만(\s?원)?|\d+\s*천(\s?원)?)/.test(
      t,
    );
  const hasSpendVerb =
    /(샀|샀어|구매|결제|지출|썼|썼어|냈|냈어|기록|입력|베었|나갔)/.test(t);

  const statsPhrase =
    /(총\s?지출|가장|제일|몇\s?건|이번\s?달.*얼마|지난주.*얼마|어제\s?뭐|식비|항목별|분류별)/.test(
      t,
    );

  const looksLikeNewExpense =
    hasPurchaseAmount &&
    hasSpendVerb &&
    !endsWithQuestion &&
    !hasQuestionWord &&
    !statsPhrase;

  if (looksLikeNewExpense) return "expense";
  if (endsWithQuestion || hasQuestionWord || statsPhrase) return "stats";
  if (hasPurchaseAmount && !hasQuestionWord && !statsPhrase) return "expense";

  return "expense";
}
