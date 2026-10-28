"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand-page-bg px-4 py-8">
      <div className="w-full max-w-sm rounded-[16px] border border-brand-border bg-brand-surface px-5 py-6 shadow-sm">
        <div className="mb-6 flex items-start gap-2.5">
          <span
            className="mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-brand-green"
            aria-hidden
          />
          <div>
            <h1 className="text-xl font-bold text-brand-ink">UNITHE 법카노트</h1>
            <p className="mt-1 text-sm text-brand-muted">로그인 후 사용내역을 확인할 수 있습니다.</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
            이메일
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              className="h-12 rounded-[12px] border border-brand-border bg-brand-surface px-3 text-base text-brand-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </label>

          {error && (
            <p className="text-sm text-[#b3261e]" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-12 rounded-[12px] bg-brand-green text-base font-medium text-white hover:bg-brand-green-hover disabled:opacity-70"
          >
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-brand-muted">
          계정은 Supabase Dashboard에서만 생성합니다. 공개 회원가입은 제공하지 않습니다.
        </p>
      </div>
    </div>
  );
}
