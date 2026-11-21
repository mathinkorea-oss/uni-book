"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LoginNavLink } from "@/components/login/login-nav-link";
import { LoginShell } from "@/components/login/login-shell";
import { RecoveryLinkBootstrap } from "@/components/login/recovery-link-bootstrap";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    window.location.href = "/";
  }

  return (
  <>
    <RecoveryLinkBootstrap />
    <LoginShell
      title="유니더노트"
      description="등록 이메일과 비밀번호로 로그인한 뒤 사용내역을 확인할 수 있습니다."
    >
      {resetSuccess ? (
        <p
          className="mb-4 rounded-[12px] bg-brand-saved-bg px-3 py-2.5 text-sm text-brand-ink"
          role="status"
        >
          비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.
        </p>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
          이메일 (로그인 아이디)
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="이메일 로그인 아이디"
            className="h-12 rounded-[12px] border border-brand-border bg-brand-surface px-3 text-base text-brand-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
          비밀번호
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="비밀번호"
            className="h-12 rounded-[12px] border border-brand-border bg-brand-surface px-3 text-base text-brand-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
        </label>

        {error ? (
          <p className="text-sm text-[#b3261e]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 h-12 rounded-[12px] bg-brand-green text-base font-medium text-white hover:bg-brand-green-hover disabled:opacity-70"
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <LoginNavLink href="/login/find-id">아이디 찾기</LoginNavLink>
        <LoginNavLink href="/login/forgot-password">비밀번호 재설정</LoginNavLink>
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-brand-muted">
        계정은 Supabase Dashboard에서만 생성합니다. 공개 회원가입은 제공하지 않습니다.
      </p>
    </LoginShell>
  </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginShell title="유니더노트" description="불러오는 중…">
          <p className="text-sm text-brand-muted">잠시만 기다려 주세요.</p>
        </LoginShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}