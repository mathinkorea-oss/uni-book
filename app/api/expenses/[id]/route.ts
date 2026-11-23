import { NextResponse } from "next/server";
import { resolveSelectableCategoryCode } from "@/lib/validate-category-code";
import {
  buildSemanticInput,
  findSemanticSmsDuplicate,
} from "@/lib/sms-dedup";
import { buildSmsSemanticKey } from "@/lib/sms-semantic-key";
import { assertUserOwnsCard } from "@/lib/user-cards-server";
import { EXPENSE_SELECT } from "@/lib/supabase/client";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

type PatchBody = {
  date?: string;
  amount?: number;
  description?: string;
  note?: string;
  category_code?: string;
  category_user_set?: boolean;
  card_id?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;
  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!body.date?.trim()) {
    return NextResponse.json({ error: "날짜를 입력해 주세요." }, { status: 400 });
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "사용 내용을 입력해 주세요." }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!amount || amount <= 0 || Number.isNaN(amount)) {
    return NextResponse.json({ error: "올바른 금액을 입력해 주세요." }, { status: 400 });
  }

  const { supabase, user } = auth;

  const { data: current } = await supabase
    .from("expenses")
    .select(
      "id, card_id, sms_semantic_key, sms_confirmed_year, payment_time, sms_fingerprint, category_code, category_user_set, category_needs_review",
    )
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json(
      { error: "수정할 수 없습니다. 내 기록만 수정할 수 있습니다." },
      { status: 403 },
    );
  }

  const nextCardId = body.card_id ?? current.card_id;
  if (!nextCardId) {
    return NextResponse.json({ error: "카드를 선택해 주세요." }, { status: 400 });
  }

  const owned = await assertUserOwnsCard(supabase, user.id, nextCardId);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.message }, { status: 403 });
  }

  const currentCode = current.category_code ?? "other";
  const requestedCode =
    body.category_code !== undefined && body.category_code !== null
      ? String(body.category_code).trim()
      : currentCode;
  const categoryChanged = requestedCode !== currentCode;

  let categoryCode = currentCode;
  let categoryUserSet = Boolean(current.category_user_set);
  let categoryNeedsReview = Boolean(current.category_needs_review);

  if (categoryChanged) {
    const resolved = await resolveSelectableCategoryCode(
      supabase,
      user.id,
      requestedCode,
    );
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: 400 });
    }
    categoryCode = resolved.code;
    categoryUserSet = true;
    categoryNeedsReview = false;
  }

  const confirmedYear =
    current.sms_confirmed_year ?? Number(body.date.trim().slice(0, 4));

  let smsSemanticKey = current.sms_semantic_key;
  if (current.sms_fingerprint && current.sms_confirmed_year) {
    const semanticInput = buildSemanticInput({
      cardId: nextCardId,
      confirmedYear,
      date: body.date.trim(),
      paymentTime: current.payment_time ?? "",
      amount: Math.round(amount),
      merchant: body.description.trim(),
    });
  const dup = await findSemanticSmsDuplicate(supabase, user.id, semanticInput);
    if (dup && dup.id !== id) {
      return NextResponse.json(
        {
          error:
            "같은 카드에 동일 결제로 보이는 내역이 이미 있습니다. 카드·날짜·금액·가맹점을 확인해 주세요.",
        },
        { status: 409 },
      );
    }
    smsSemanticKey = buildSmsSemanticKey(semanticInput);
  }

  const { data, error } = await supabase
    .from("expenses")
    .update({
      date: body.date.trim(),
      amount: Math.round(amount),
      description: body.description.trim(),
      note: body.note?.trim() ?? "",
      category_code: categoryCode,
      category_user_set: categoryUserSet,
      category_needs_review: categoryNeedsReview,
      card_id: nextCardId,
      sms_semantic_key: smsSemanticKey,
    })
    .eq("id", id)
    .select(EXPENSE_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "중복된 사용내역으로 저장할 수 없습니다." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "수정을 저장하지 못했습니다. DB 마이그레이션을 확인해 주세요." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "수정할 수 없습니다. 내 기록만 수정할 수 있습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ expense: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;
  const { supabase } = auth;

  const { data, error } = await supabase.rpc("delete_expense_with_sms_marker", {
    p_expense_id: id,
  });

  if (error) {
    return NextResponse.json(
      { error: "삭제에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  const result = data as { ok?: boolean; reason?: string; id?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(
      { error: "삭제할 수 없습니다. 내 기록만 삭제할 수 있습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ deleted: true, id: result.id ?? id });
}