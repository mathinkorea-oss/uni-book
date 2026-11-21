import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { sanitizeAuthNextPath } from "@/lib/auth-redirect";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

function redirectForgot(request: NextRequest, reason: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login/forgot-password";
  url.search = "";
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const next = sanitizeAuthNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!code && !(tokenHash && type)) {
    return redirectForgot(request, "missing");
  }

  const redirectUrl = new URL(next, request.nextUrl.origin);
  let response = NextResponse.redirect(redirectUrl);
  const supabase = createRouteHandlerClient(request, response);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectForgot(request, "callback");
    }
    return response;
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      return redirectForgot(request, "otp");
    }
    return response;
  }

  return redirectForgot(request, "missing");
}