import type { SupabaseClient } from "@supabase/supabase-js";

export type EstablishRecoveryResult =
  | { status: "established" }
  | { status: "none" }
  | { status: "failed" };

/** PKCE `?code=` 또는 implicit hash 복구 토큰으로 브라우저 세션을 연결합니다. */
export async function establishRecoverySession(
  supabase: SupabaseClient,
): Promise<EstablishRecoveryResult> {
  if (typeof window === "undefined") {
    return { status: "none" };
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    url.searchParams.delete("code");
    const nextUrl = `${url.pathname}${url.search}`;
    window.history.replaceState({}, "", nextUrl);
    return error ? { status: "failed" } : { status: "established" };
  }

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!hash) {
    return { status: "none" };
  }

  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const type = hashParams.get("type");

  if (accessToken && refreshToken && type === "recovery") {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    window.history.replaceState({}, "", url.pathname + url.search);
    return error ? { status: "failed" } : { status: "established" };
  }

  return { status: "none" };
}