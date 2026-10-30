import { NextResponse } from "next/server";
import { isCategoryCode, normalizeCategoryCode } from "@/lib/categories";
import { resolveCategory } from "@/lib/classify-expense";
import { buildExpenseDateIso } from "@/lib/parse-shinhan-sms";
import { parseConfirmedYear } from "@/lib/sms-confirmed-year";
import { smsFingerprint, isValidSmsFingerprint } from "@/lib/sms-fingerprint";
import {
  buildSemanticInput,
  clearSmsDeletedMarker,
  findExactSmsDuplicate,
  findFuzzyDuplicateCandidates,
  findSemanticSmsDuplicate,
  resolveSmsDuplicateExpense,
} from "@/lib/sms-dedup";
import { buildSmsSemanticKey } from "@/lib/sms-semantic-key";
import { EXPENSE_SELECT } from "@/lib/supabase/client";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

type SaveBody = {
  rawText?: string;
  date?: string;
  amount?: number;
  description?: string;
  note?: string;
  category_code?: string;
  category_user_set?: boolean;
  payment_time?: string;
  fingerprint?: string;
  action?: "create" | "link";
  linkExpenseId?: string;
  confirmSeparate?: boolean;
  confirmReRegister?: boolean;
  confirmedYear?: number;
  sortMode?: "date" | "manual";
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;
  const { supabase, user } = auth;

  let body: SaveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawText = body.rawText?.trim();
  if (!rawText) {
    return NextResponse.json({ error: "문자 정보가 없습니다." }, { status: 400 });
  }

  const expectedFp = smsFingerprint(rawText);
  if (body.fingerprint && body.fingerprint !== expectedFp) {
    return NextResponse.json({ error: "문자 식별값이 일치하지 않습니다." }, { status: 400 });
  }
  const fingerprint = expectedFp;
  if (!isValidSmsFingerprint(fingerprint)) {
    return NextResponse.json({ error: "문자 식별값 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const date = body.date?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "날짜를 확인해 주세요." }, { status: 400 });
  }
  const [y, m, d] = date.split("-").map(Number);
  if (!buildExpenseDateIso(y, m, d)) {
    return NextResponse.json({ error: "존재하지 않는 날짜입니다." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "금액을 확인해 주세요." }, { status: 400 });
  }
  const description = body.description?.trim();
  if (!description) {
    return NextResponse.json({ error: "가맹점을 입력해 주세요." }, { status: 400 });
  }

  const confirmedYear =
    parseConfirmedYear(body.confirmedYear) ??
    parseConfirmedYear(Number(body.date?.slice(0, 4)));
  if (confirmedYear == null) {
    return NextResponse.json(
      { error: "결제 연도를 확인해 주세요." },
      { status: 400 },
    );
  }

  const paymentTime = body.payment_time?.trim() ?? "";

  const semanticInput = buildSemanticInput({
    confirmedYear,
    date,
    paymentTime,
    amount,
    merchant: description,
  });
  const semanticKey = buildSmsSemanticKey(semanticInput);

  const exact = await findExactSmsDuplicate(
    supabase,
    user.id,
    fingerprint,
    confirmedYear,
  );
  if (exact) {
    return NextResponse.json({
      duplicate: true,
      message: "이미 저장된 사용내역입니다.",
      expense: exact,
    });
  }

  const semanticDup = await findSemanticSmsDuplicate(
    supabase,
    user.id,
    semanticInput,
  );
  if (semanticDup) {
    return NextResponse.json({
      duplicate: true,
      message:
        "같은 결제(날짜·시간·금액·가맹점)로 이미 저장된 내역입니다. 문자 형식만 다를 수 있습니다.",
      expense: semanticDup,
      semanticDuplicate: true,
    });
  }

  if (body.action === "link" && body.linkExpenseId) {
    const { data: existing, error: fetchErr } = await supabase
      .from("expenses")
      .select("id, date, amount, description, sms_fingerprint")
      .eq("id", body.linkExpenseId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "기존 기록을 찾을 수 없습니다." }, { status: 404 });
    }
    if (existing.sms_fingerprint) {
      return NextResponse.json({
        duplicate: true,
        message: "이미 다른 승인 문자와 연결된 기록입니다.",
      });
    }

    const dupByYear = await resolveSmsDuplicateExpense(
      supabase,
      user.id,
      fingerprint,
      confirmedYear,
      semanticInput,
    );
    if (dupByYear) {
      return NextResponse.json({
        duplicate: true,
        message: "이미 저장된 사용내역입니다.",
        expense: dupByYear,
      });
    }

    const { data: linked, error: linkErr } = await supabase
      .from("expenses")
      .update({
        sms_fingerprint: fingerprint,
        sms_confirmed_year: confirmedYear,
        sms_semantic_key: semanticKey,
        payment_time: paymentTime || null,
      })
      .eq("id", body.linkExpenseId)
      .select(EXPENSE_SELECT)
      .maybeSingle();

    if (linkErr || !linked) {
      if (linkErr?.code === "23505") {
        const dup = await resolveSmsDuplicateExpense(
          supabase,
          user.id,
          fingerprint,
          confirmedYear,
          semanticInput,
        );
        return NextResponse.json({
          duplicate: true,
          message: "이미 저장된 사용내역입니다.",
          expense: dup,
        });
      }
      return NextResponse.json({ error: "연결에 실패했습니다." }, { status: 500 });
    }

    await clearSmsDeletedMarker(
      supabase,
      user.id,
      fingerprint,
      confirmedYear,
    );
    return NextResponse.json({ linked: true, expense: linked });
  }

  if (!body.confirmSeparate) {
    const semanticAgain = await findSemanticSmsDuplicate(
      supabase,
      user.id,
      semanticInput,
    );
    if (semanticAgain) {
      return NextResponse.json({
        duplicate: true,
        message:
          "같은 결제(날짜·시간·금액·가맹점)로 이미 저장된 내역입니다. 문자 형식만 다를 수 있습니다.",
        expense: semanticAgain,
        semanticDuplicate: true,
      });
    }

    const fuzzy = await findFuzzyDuplicateCandidates(
      supabase,
      user.id,
      date,
      amount,
      description,
      fingerprint,
      semanticInput,
    );
    if (fuzzy.length) {
      return NextResponse.json({
        needsFuzzyConfirm: true,
        fuzzyCandidates: fuzzy,
      });
    }
  }

  const { data: deletedMarker } = await supabase
    .from("expense_sms_deleted_markers")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("sms_fingerprint", fingerprint)
    .eq("sms_confirmed_year", confirmedYear)
    .maybeSingle();

  if (deletedMarker && !body.confirmReRegister) {
    return NextResponse.json({
      needsReRegisterConfirm: true,
      message: "이전에 삭제한 내역과 같은 승인 문자입니다. 다시 등록할까요?",
    });
  }

  const categoryCode =
    body.category_code && isCategoryCode(body.category_code)
      ? body.category_code
      : normalizeCategoryCode(body.category_code);
  const classified = resolveCategory(
    description,
    body.note?.trim() ?? "",
    categoryCode,
  );

  let sortOrder: number | null = null;
  if (body.sortMode === "manual") {
    const monthPrefix = date.slice(0, 7);
    const { data: monthRows } = await supabase
      .from("expenses")
      .select("sort_order")
      .gte("date", `${monthPrefix}-01`)
      .lte("date", `${monthPrefix}-31`);
    const orders = (monthRows ?? [])
      .map((r) => r.sort_order)
      .filter((v): v is number => typeof v === "number");
    sortOrder = (orders.length ? Math.min(...orders) : 0) - 1;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      date,
      amount: Math.round(amount),
      description,
      note: body.note?.trim() ?? "",
      category_code: classified.code,
      category_needs_review: body.category_user_set
        ? false
        : classified.needsReview,
      category_user_set: Boolean(body.category_user_set),
      sort_order: sortOrder,
      sms_fingerprint: fingerprint,
      sms_confirmed_year: confirmedYear,
      sms_semantic_key: semanticKey,
      payment_time: paymentTime || null,
    })
    .select(EXPENSE_SELECT)
    .single();

  if (insertErr || !inserted) {
    if (insertErr?.code === "23505") {
      const dup = await resolveSmsDuplicateExpense(
        supabase,
        user.id,
        fingerprint,
        confirmedYear,
        semanticInput,
      );
      return NextResponse.json({
        duplicate: true,
        message: "이미 저장된 사용내역입니다.",
        expense: dup,
      });
    }
    return NextResponse.json({ error: "저장에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
  }

  await clearSmsDeletedMarker(
    supabase,
    user.id,
    fingerprint,
    confirmedYear,
  );

  return NextResponse.json({
    saved: true,
    expense: inserted,
  });
}
