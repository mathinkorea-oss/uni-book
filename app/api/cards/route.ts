import { NextResponse } from "next/server";
import { ensureUserCards } from "@/lib/user-cards-server";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  const { cards, error } = await ensureUserCards(auth.supabase);
  if (error) {
    return NextResponse.json(
      { error: "카드 목록을 불러오지 못했습니다. DB 마이그레이션을 확인해 주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({ cards });
}