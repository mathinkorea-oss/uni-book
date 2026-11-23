"use client";

import { useEffect, useState } from "react";
import {
  CATEGORY_GROUPS,
  type CategoryCode,
  getCategoryLabel,
  isCategoryCode,
} from "@/lib/categories";
import type { UserCardRow } from "@/lib/cards";
import type { ExpenseRow } from "@/lib/supabase/client";
import { expenseTextParts } from "@/lib/expense-parse";

type Props = {
  entry: ExpenseRow | null;
  cards: UserCardRow[];
  open: boolean;
  onClose: () => void;
  onSaved: (expense: ExpenseRow, previousDate: string) => void;
};

export function ExpenseEditSheet({ entry, cards, open, onClose, onSaved }: Props) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<CategoryCode>("other");
  const [cardId, setCardId] = useState("");
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
    setCardId(entry.card_id ?? cards[0]?.id ?? "");
    setError(null);
  }, [entry, cards]);

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
          card_id: cardId,
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
          {cards.length > 0 ? (
            <label className="flex flex-col gap-1 text-sm text-brand-muted">
              카드
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="h-11 rounded-[10px] border border-brand-border bg-brand-surface px-3 text-base text-brand-ink"
                aria-label="카드 선택"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {entry.installment_months ? (
            <p className="text-sm text-brand-muted">
              할부 {entry.installment_months}개월 (문자 등록 정보)
            </p>
          ) : null}
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
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
            메모
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            분류
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryCode)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            >
              {CATEGORY_GROUPS.flatMap((g) =>
                g.codes.map((c) => (
                  <option key={c} value={c}>
                    {getCategoryLabel(c)}
                  </option>
                )),
              )}
            </select>
          </label>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-[#b3261e]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="sticky bottom-0 mt-5 flex shrink-0 flex-col-reverse gap-2 border-t border-brand-border bg-brand-surface pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="box-border flex min-h-12 h-12 flex-1 items-center justify-center rounded-[12px] border border-brand-border text-base"
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="box-border flex min-h-12 h-12 flex-1 items-center justify-center rounded-[12px] bg-brand-green text-base font-medium text-white disabled:opacity-70"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}