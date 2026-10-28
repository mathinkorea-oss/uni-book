import { NextResponse } from "next/server";
import { isCategoryCode, normalizeCategoryCode } from "@/lib/categories";
import { EXPENSE_SELECT } from "@/lib/supabase/client";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

type PatchBody = {
  date?: string;
  amount?: number;
  description?: string;
  note?: string;
  category_code?: string;
  category_user_set?: boolean;
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

  const categoryCode =
    body.category_code && isCategoryCode(body.category_code)
      ? body.category_code
      : normalizeCategoryCode(body.category_code);

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("expenses")
    .update({
      date: body.date.trim(),
      amount: Math.round(amount),
      description: body.description.trim(),
      note: body.note?.trim() ?? "",
      category_code: categoryCode,
      category_user_set: Boolean(body.category_user_set),
      category_needs_review: false,
    })
    .eq("id", id)
    .select(EXPENSE_SELECT)
    .maybeSingle();

  if (error) {
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

  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: "삭제에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  if (!data?.length) {
    return NextResponse.json(
      { error: "삭제할 수 없습니다. 내 기록만 삭제할 수 있습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ deleted: true, id: data[0].id });
}
