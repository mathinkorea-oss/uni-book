"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LogoutIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("로그아웃에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      window.location.href = "/login";
    } catch {
      setError("로그아웃에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loading}
        aria-label="로그아웃"
        title="로그아웃"
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[10px] border border-brand-border px-2.5 text-brand-muted hover:bg-brand-user-bubble disabled:opacity-60 sm:px-3"
      >
        <LogoutIcon />
        <span className="hidden text-sm sm:inline">
          {loading ? "로그아웃…" : "로그아웃"}
        </span>
      </button>
      {error && (
        <p
          className="absolute right-0 top-full z-10 mt-1 max-w-[12rem] rounded-[8px] border border-brand-border bg-brand-surface px-2 py-1 text-xs text-[#b3261e] shadow-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
