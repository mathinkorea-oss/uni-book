"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LoginNavLink } from "@/components/login/login-nav-link";
import { LoginShell } from "@/components/login/login-shell";
import { buildPasswordRecoveryRedirectUrl } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

const REQUEST_OK_MESSAGE =
  "입력하신 주소가 등록되어 있다면 비밀번호 재설정 메일이 발송됩니다.";

const LINK_ERROR_MESSAGES: Record<string, string> = {
  callback:
    "재설정 링크가 만료되었거나 잘못되었습니다. 아래에서 메일을 다시 요청해 주세요.",
  otp: "재설정 링크가 만료되었거나 잘못되었습니다. 아래에서 메일을 다시 요청해 주세요.",
  missing:
    "재설정 링크가 올바르지 않습니다. 아래에서 메일을 다시 요청해 주세요.",
};

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const supabase = createClient();
    const redirectTo = buildPasswordRecoveryRedirectUrl();

    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);
    setSubmitted(true);
  }

  const bannerFromLink =
    linkError && LINK_ERROR_MESSAGES[linkError]
      ? LINK_ERROR_MESSAGES[linkError]
      : null;

  return (
    <LoginShell
      title="비밀번호 재설정"
      description="가입 시 등록한 이메일로 재설정 안내를 보내드립니다."
    >
      {bannerFromLink ? (
        <p className="mb-4 text-sm text-[#b3261e]" role="alert">
          {bannerFromLink}
        </p>
      ) : null}

      {submitted ? (
        <p className="text-sm leading-relaxed text-brand-ink" role="status">
          {REQUEST_OK_MESSAGE}
        </p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
            이메일
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="등록 이메일"
              className="h-12 rounded-[12px] border border-brand-border bg-brand-surface px-3 text-base text-brand-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-12 rounded-[12px] bg-brand-green text-base font-medium text-white hover:bg-brand-green-hover disabled:opacity-70"
          >
            {loading ? "요청 중…" : "재설정 메일 보내기"}
          </button>
        </form>
      )}

      <div className="mt-6 flex flex-col items-center gap-1 border-t border-brand-border pt-5">
        <LoginNavLink href="/login">로그인으로 돌아가기</LoginNavLink>
      </div>
    </LoginShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <LoginShell title="비밀번호 재설정" description="불러오는 중…">
          <p className="text-sm text-brand-muted">잠시만 기다려 주세요.</p>
        </LoginShell>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}