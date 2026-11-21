"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginShell } from "@/components/login/login-shell";
import { PasswordField } from "@/components/login/password-field";
import { establishRecoverySession } from "@/lib/auth/recovery-session";
import { MIN_PASSWORD_LENGTH, validatePasswordPair } from "@/lib/auth-password";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const finish = (ready: boolean) => {
      if (active) setSessionReady(ready);
    };

    void (async () => {
      const recovery = await establishRecoverySession(supabase);

      if (recovery.status === "failed") {
        finish(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (recovery.status === "established" || session) {
        finish(true);
        return;
      }

      finish(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        finish(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const validationError = validatePasswordPair(password, confirm);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError(null);
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      if (
        updateError.message.toLowerCase().includes("session") ||
        updateError.status === 401
      ) {
        setSessionReady(false);
        setError(
          "재설정 링크가 만료되었거나 유효하지 않습니다. 비밀번호 재설정을 다시 요청해 주세요.",
        );
        return;
      }
      setError("비밀번호를 변경할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    window.location.href = "/login?reset=success";
  }

  if (sessionReady === null) {
    return (
      <LoginShell title="새 비밀번호 설정" description="세션을 확인하는 중…">
        <p className="text-sm text-brand-muted">잠시만 기다려 주세요.</p>
      </LoginShell>
    );
  }

  if (!sessionReady) {
    return (
      <LoginShell
        title="새 비밀번호 설정"
        description="재설정 링크가 필요합니다."
      >
        <p className="text-sm leading-relaxed text-[#b3261e]" role="alert">
          {error ??
            "재설정 링크가 만료되었거나 잘못되었습니다. 아래에서 메일을 다시 요청해 주세요."}
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/login/forgot-password"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-green text-base font-medium text-white hover:bg-brand-green-hover"
          >
            비밀번호 재설정 다시 요청
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-brand-green underline-offset-2 hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </LoginShell>
    );
  }

  return (
    <LoginShell
      title="새 비밀번호 설정"
      description={`새 비밀번호를 입력해 주세요. (최소 ${MIN_PASSWORD_LENGTH}자)`}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <PasswordField
          label="새 비밀번호"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          minLength={MIN_PASSWORD_LENGTH}
        />
        <PasswordField
          label="새 비밀번호 확인"
          name="new-password-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          minLength={MIN_PASSWORD_LENGTH}
        />

        {fieldError ? (
          <p className="text-sm text-[#b3261e]" role="alert">
            {fieldError}
          </p>
        ) : null}
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
          {loading ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>

      <div className="mt-6 flex justify-center">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-brand-green underline-offset-2 hover:underline"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </LoginShell>
  );
}