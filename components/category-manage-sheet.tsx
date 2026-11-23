"use client";

import { useEffect, useState } from "react";
import type { UserCategoryRow } from "@/lib/user-categories";

type Props = {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export function CategoryManageSheet({ open, onClose, onUpdated }: Props) {
  const [categories, setCategories] = useState<UserCategoryRow[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/user-categories");
      const data = await res.json();
      setCategories(data.categories ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNewName("");
    void load();
  }, [open]);

  async function saveName(row: UserCategoryRow, name: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/user-categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      await load();
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: UserCategoryRow) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/user-categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "변경에 실패했습니다.");
        return;
      }
      await load();
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function move(row: UserCategoryRow, dir: -1 | 1) {
    const idx = categories.findIndex((c) => c.id === row.id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= categories.length) return;
    const ordered = [...categories];
    const [removed] = ordered.splice(idx, 1);
    ordered.splice(next, 0, removed);
    setCategories(ordered);
    await fetch("/api/user-categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ordered.map((c) => c.id) }),
    });
    onUpdated();
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name) {
      setError("분류 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "추가에 실패했습니다.");
        return;
      }
      setNewName("");
      await load();
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 lg:items-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[16px] border border-brand-border bg-brand-surface lg:rounded-[16px]"
      >
        <div className="shrink-0 border-b border-brand-border px-4 py-3">
          <h2 className="text-lg font-semibold text-brand-ink">분류 관리</h2>
          <p className="mt-0.5 text-sm text-brand-muted">
            이름·순서·사용 중지만 바꿉니다. 기록에 저장된 분류 코드는 유지됩니다.
            사용자 분류 추가만으로 자동 분류 규칙이 생기지는 않습니다.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-brand-muted">불러오는 중…</p>
          ) : (
            <ul className="space-y-2">
              {categories.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[12px] border border-brand-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={row.display_name}
                      disabled={saving}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== row.display_name) void saveName(row, v);
                      }}
                      className="min-w-0 flex-1 rounded-[8px] border border-brand-border px-2 py-2 text-base"
                      aria-label={`${row.display_name} 이름`}
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void move(row, -1)}
                      className="h-10 w-9 rounded-[8px] border border-brand-border text-sm"
                      aria-label="위로"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void move(row, 1)}
                      className="h-10 w-9 rounded-[8px] border border-brand-border text-sm"
                      aria-label="아래로"
                    >
                      ↓
                    </button>
                  </div>
                  <CategoryRowMeta
                    row={row}
                    onToggle={() => void toggleActive(row)}
                    saving={saving}
                  />
                </li>
              ))}
            </ul>
          )}
          <PackageNew
            newName={newName}
            saving={saving}
            onNameChange={setNewName}
            onAdd={() => void addCategory()}
          />
          {error ? (
            <p className="mt-2 text-sm text-[#b3261e]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 border-t border-brand-border p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-[12px] bg-brand-green text-base font-medium text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRowMeta({
  row,
  onToggle,
  saving,
}: {
  row: UserCategoryRow;
  onToggle: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted">
      <span>
        {row.is_builtin ? "기본 분류" : "사용자 분류"} · 코드 {row.code}
      </span>
      <button
        type="button"
        disabled={saving}
        onClick={onToggle}
        className="rounded-[8px] border border-brand-border px-2 py-1 text-sm text-brand-ink"
      >
        {row.is_active ? "사용 중지" : "다시 사용"}
      </button>
    </div>
  );
}

function PackageNew({
  newName,
  saving,
  onNameChange,
  onAdd,
}: {
  newName: string;
  saving: boolean;
  onNameChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mt-4 rounded-[12px] border border-dashed border-brand-border px-3 py-3">
      <p className="text-sm font-medium text-brand-ink">분류 추가</p>
      <div className="mt-2 flex gap-2">
        <input
          value={newName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="새 분류 이름"
          className="min-w-0 flex-1 rounded-[10px] border border-brand-border px-3 py-2 text-base"
        />
        <button
          type="button"
          disabled={saving}
          onClick={onAdd}
          className="h-11 shrink-0 rounded-[10px] bg-brand-green px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          추가
        </button>
      </div>
    </div>
  );
}