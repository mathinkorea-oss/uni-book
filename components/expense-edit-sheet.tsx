"use client";

import { useEffect, useState } from "react";
import {
  CATEGORY_GROUPS,
  type CategoryCode,
  getCategoryLabel,
  isCategoryCode,
} from "@/lib/categories";
import type { ExpenseRow } from "@/lib/supabase/client";
import { expenseTextParts } from "@/lib/expense-parse";

type Props = {
  entry: ExpenseRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (expense: ExpenseRow, previousDate: string) => void;
};

export function ExpenseEditSheet({ entry, open, onClose, onSaved }: Props) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<CategoryCode>("other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    const parts = expenseTextParts(entry);
    setDate(entry.date);
    setAmount(String(entry.amount));
    setDescription(parts.main);
    setNote(parts.note ?? "");
    setCategory(
      isCategoryCode(entry.category_code ?? "")
        ? (entry.category_code as CategoryCode)
        : "other",
    );
    setError(null);
  }, [entry]);

  if (!open || !entry) return null;

  async function handleSave() {
    if (saving) return;
    setError(null);
    setSaving(true);
    const previousDate = entry!.date;
    try {
      const res = await fetch(`/api/expenses/${entry!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          amount: Number(amount.replace(/[^\d]/g, "")),
          description,
          note,
          category_code: category,
          category_user_set: true,
        }),
      });
      const data = (await res.json()) as {
        expense?: ExpenseRow;
        error?: string;
      };
      if (!res.ok || !data.expense) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved(data.expense, previousDate);
      onClose();
    } catch {
      setError("저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-[14px] border border-brand-border bg-brand-surface p-5 lg:rounded-[14px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-expense-title"
      >
        <h3 id="edit-expense-title" className="text-lg font-semibold text-brand-ink">
          사용내역 수정
        </h3>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            날짜
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            금액
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            사용 내용
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            참고
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-[10px] border border-brand-border px-3 py-2 text-base text-brand-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            사용 항목
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryCode)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            >
              {CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.codes.map((code) => (
                    <option key={code} value={code}>
                      {getCategoryLabel(code)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-[#b3261e]">{error}</p>}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 flex-1 rounded-[10px] border border-brand-border text-base text-brand-ink"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-11 flex-1 rounded-[10px] bg-brand-green text-base font-medium text-white disabled:opacity-60"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
