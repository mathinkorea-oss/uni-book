"use client";

import { useEffect } from "react";
import { LoginShell } from "@/components/login/login-shell";
import { establishRecoverySession } from "@/lib/auth/recovery-session";
import { createClient } from "@/lib/supabase/client";

/** Site URL이 `/`일 때 hash·code 복구 링크를 받기 위한 경량 랜딩 (선택적 Redirect URL). */
export default function RecoveryRedirectPage() {
  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const recovery = await establishRecoverySession(supabase);
      if (recovery.status === "established") {
        window.location.replace("/login/update-password");
        return;
      }
      window.location.replace(
        recovery.status === "failed"
          ? "/login/forgot-password?error=callback"
          : "/login/forgot-password?error=missing",
      );
    })();
  }, []);

  return (
    <LoginShell title="비밀번호 재설정" description="연결하는 중…">
      <p className="text-sm text-brand-muted">잠시만 기다려 주세요.</p>
    </LoginShell>
  );
}