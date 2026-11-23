import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isValidNewCategoryName,
  validateUserCategoryInsertCode,
} from "@/lib/user-categories";
import {
  ensureUserCategories,
} from "@/lib/user-categories-server";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  const { categories, error } = await ensureUserCategories(auth.supabase);
  if (error) {
    return NextResponse.json(
      { error: "분류 목록을 불러오지 못했습니다. DB 마이그레이션을 확인해 주세요." },
      { status: 500 },
    );
  }
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  let body: { display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = body.display_name?.trim() ?? "";
  if (!isValidNewCategoryName(name)) {
    return NextResponse.json(
      { error: "분류 이름을 입력해 주세요. (최대 40자)" },
      { status: 400 },
    );
  }

  const { categories, error: loadErr } = await ensureUserCategories(auth.supabase);
  if (loadErr) {
    return NextResponse.json({ error: loadErr }, { status: 500 });
  }

  const dup = categories.some(
    (c) => c.display_name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (dup) {
    return NextResponse.json(
      { error: "이미 같은 이름의 분류가 있습니다." },
      { status: 409 },
    );
  }

  const code = `custom_${randomBytes(4).toString("hex")}`;
  const codeCheck = validateUserCategoryInsertCode(code);
  if (!codeCheck.ok) {
    return NextResponse.json({ error: codeCheck.message }, { status: 400 });
  }

  const sortOrder =
    categories.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;

  const { data, error } = await auth.supabase
    .from("user_expense_categories")
    .insert({
      user_id: auth.user.id,
      code,
      display_name: name,
      sort_order: sortOrder,
      is_active: true,
      is_builtin: false,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "이미 같은 이름의 분류가 있습니다." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}