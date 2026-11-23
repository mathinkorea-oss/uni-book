import { NextResponse } from "next/server";
import { isValidNewCategoryName } from "@/lib/user-categories";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

type PatchBody = {
  display_name?: string;
  is_active?: boolean;
  sort_order?: number;
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

  const updates: PatchBody = {};
  if (body.display_name !== undefined) {
    const name = body.display_name.trim();
    if (!isValidNewCategoryName(name)) {
      return NextResponse.json(
        { error: "분류 이름을 입력해 주세요." },
        { status: 400 },
      );
    }
    updates.display_name = name;
  }
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    updates.sort_order = Math.max(0, Math.floor(body.sort_order));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("user_expense_categories")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "이미 같은 이름의 분류가 있습니다." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "분류를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ category: data });
}