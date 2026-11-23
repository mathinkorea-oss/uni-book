import { NextResponse } from "next/server";
import { getCategoryLabel } from "@/lib/categories";
import { parseCardSms } from "@/lib/parse-card-sms";
import { buildExpenseDateIso } from "@/lib/parse-shinhan-sms";
import { parseConfirmedYear } from "@/lib/sms-confirmed-year";
import { smsFingerprint } from "@/lib/sms-fingerprint";
import {
  buildSemanticInput,
  findDeletedSmsMarker,
  findExactSmsDuplicate,
  findFuzzyDuplicateCandidates,
  findSemanticSmsDuplicate,
} from "@/lib/sms-dedup";
import { buildSmsSemanticKey } from "@/lib/sms-semantic-key";
import { formatDateWithWeekday } from "@/lib/expense-date";
import {
  ensureUserCards,
  resolveCardIdFromParse,
} from "@/lib/user-cards-server";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

function koreaYearNow(): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  });
  return Number(fmt.format(new Date()));
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  let body: { rawText?: string; year?: number; cardId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawText = body.rawText?.trim();
  if (!rawText) {
    return NextResponse.json({ error: "문자 내용을 입력해 주세요." }, { status: 400 });
  }

  const parsed = parseCardSms(rawText);
  if (!parsed.ok) {
    return NextResponse.json({ parseError: parsed.error });
  }

  const year = typeof body.year === "number" ? body.year : koreaYearNow();
  const confirmedYear = parseConfirmedYear(year);
  if (confirmedYear == null) {
    return NextResponse.json(
      { error: "결제 연도를 확인해 주세요." },
      { status: 400 },
    );
  }
  const dateIso = buildExpenseDateIso(
    confirmedYear,
    parsed.data.month,
    parsed.data.day,
  );
  if (!dateIso) {
    return NextResponse.json({
      parseError: {
        kind: "error",
        message: "존재하지 않는 날짜입니다. 연도·월·일을 확인해 주세요.",
      },
    });
  }

  const { supabase, user } = auth;
  const { cards, error: cardsError } = await ensureUserCards(supabase);
  if (cardsError || !cards.length) {
    return NextResponse.json(
      { error: "카드 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const cardResolve = resolveCardIdFromParse({
    cards,
    detectedCode: parsed.data.cardCode,
    detectedDigits: parsed.data.cardDigits,
    selectedCardId: body.cardId,
  });

  if (cardResolve.needsSelection) {
    return NextResponse.json({
      needsCardSelection: true,
      cards,
      detectedCardCode: parsed.data.cardCode,
      detectedCardDigits: parsed.data.cardDigits,
      fingerprint: smsFingerprint(rawText),
    });
  }

  const cardId = cardResolve.cardId!;
  const fingerprint = smsFingerprint(rawText);

  const semanticInput = buildSemanticInput({
    cardId,
    confirmedYear,
    date: dateIso,
    paymentTime: parsed.data.time,
    amount: parsed.data.amount,
    merchant: parsed.data.merchant,
  });

  const exactFp = await findExactSmsDuplicate(
    supabase,
    user.id,
    cardId,
    fingerprint,
    confirmedYear,
  );
  const exactSemantic = exactFp
    ? null
    : await findSemanticSmsDuplicate(supabase, user.id, semanticInput);
  const exact = exactFp ?? exactSemantic;
  const wasDeleted = await findDeletedSmsMarker(
    supabase,
    user.id,
    cardId,
    fingerprint,
    confirmedYear,
  );
  const fuzzy = exact
    ? []
    : await findFuzzyDuplicateCandidates(
        supabase,
        user.id,
        cardId,
        dateIso,
        parsed.data.amount,
        parsed.data.merchant,
        fingerprint,
        semanticInput,
      );

  const { suggestCategoryFromMerchant } = await import("@/lib/parse-shinhan-sms");
  const category = suggestCategoryFromMerchant(parsed.data.merchant);

  return NextResponse.json({
    fingerprint,
    semanticKey: buildSmsSemanticKey(semanticInput),
    cardId,
    cardMismatch: cardResolve.mismatch,
    detectedCardCode: parsed.data.cardCode,
    detectedCardDigits: parsed.data.cardDigits,
    cards,
    yearNeedsConfirm: true,
    suggestedYear: confirmedYear,
    confirmedYear,
    date: dateIso,
    dateLabel: formatDateWithWeekday(dateIso),
    time: parsed.data.time,
    amount: parsed.data.amount,
    installmentMonths: parsed.data.installmentMonths,
    merchant: parsed.data.merchant,
    category_code: category.code,
    category_label: getCategoryLabel(category.code),
    category_needs_review: category.needsReview,
    exactDuplicate: exact,
    duplicateReason: exactSemantic
      ? "same_payment_different_format"
      : exactFp
        ? "same_sms_text"
        : null,
    fuzzyCandidates: fuzzy,
    previouslyDeleted: wasDeleted,
  });
}