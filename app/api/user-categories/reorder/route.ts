import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  let body: { orderedIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const ids = body.orderedIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "순서 정보가 없습니다." }, { status: 400 });
  }

  for (let i = 0; i < ids.length; i += 1) {
    const { error } = await auth.supabase
      .from("user_expense_categories")
      .update({ sort_order: i })
      .eq("id", ids[i])
      .eq("user_id", auth.user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}