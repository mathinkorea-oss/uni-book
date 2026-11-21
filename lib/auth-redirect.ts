/** Relative in-app paths only (open redirect prevention). */
export function sanitizeAuthNextPath(
  next: string | null | undefined,
  fallback = "/login/update-password",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}

/**
 * Browser: current origin. Server/build: NEXT_PUBLIC_SITE_URL or VERCEL_URL.
 * Set NEXT_PUBLIC_SITE_URL in Vercel to your canonical app URL (e.g. https://app.example.com).
 */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** 재설정 메일의 redirectTo — 메일 링크가 바로 새 비밀번호 화면으로 옵니다 (PKCE code는 쿼리로 전달). */
export function buildPasswordRecoveryRedirectUrl(): string {
  const origin = getSiteOrigin();
  return `${origin}/login/update-password`;
}

/** token_hash 템플릿용 — 서버에서 OTP 검증 후 next로 이동합니다. */
export function buildAuthCallbackUrl(nextPath: string): string {
  const next = sanitizeAuthNextPath(nextPath);
  const origin = getSiteOrigin();
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}