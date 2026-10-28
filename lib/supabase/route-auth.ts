import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(): Promise<
  { user: User; supabase: Awaited<ReturnType<typeof createClient>> } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  return { user, supabase };
}

export function isAuthError(
  result: { user: User } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
