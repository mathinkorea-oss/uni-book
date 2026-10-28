"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loading}
      className="shrink-0 rounded-[10px] border border-brand-border px-3 py-2 text-sm text-brand-muted hover:bg-brand-user-bubble disabled:opacity-60"
    >
      {loading ? "로그아웃…" : "로그아웃"}
    </button>
  );
}
