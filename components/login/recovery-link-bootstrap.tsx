"use client";

import { useEffect } from "react";
import { establishRecoverySession } from "@/lib/auth/recovery-session";
import { createClient } from "@/lib/supabase/client";

/**
 * Site URL이 / 또는 /login으로만 잡혀 있을 때 메일 링크(code·hash)를
 * 새 비밀번호 화면으로 넘깁니다.
 */
export function RecoveryLinkBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasCode = new URL(window.location.href).searchParams.has("code");
    const hasRecoveryHash =
      window.location.hash.includes("access_token") &&
      window.location.hash.includes("type=recovery");

    if (!hasCode && !hasRecoveryHash) return;

    void (async () => {
      const supabase = createClient();
      const recovery = await establishRecoverySession(supabase);
      if (recovery.status === "established") {
        window.location.replace("/login/update-password");
        return;
      }
      if (recovery.status === "failed") {
        window.location.replace("/login/forgot-password?error=callback");
      }
    })();
  }, []);

  return null;
}