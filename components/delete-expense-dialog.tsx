"use client";

import { useEffect, useRef } from "react";
import type { ExpenseRow } from "@/lib/supabase/client";
import { expenseTextParts } from "@/lib/expense-parse";

type Props = {
  entry: ExpenseRow | null;
  open: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteExpenseDialog({
  entry,
  open,
  deleting,
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open || !entry) return null;

  const { main } = expenseTextParts(entry);
  const amountLabel = `${new Intl.NumberFormat("ko-KR").format(entry.amount)}원`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-expense-title"
        aria-describedby="delete-expense-desc"
        className="w-full max-w-md rounded-[16px] border border-brand-border bg-brand-surface px-4 py-5 shadow-lg sm:px-5"
      >
        <h2 id="delete-expense-title" className="text-lg font-semibold text-brand-ink">
          사용내역 삭제
        </h2>
        <p id="delete-expense-desc" className="mt-3 text-sm leading-relaxed text-brand-ink">
          <span className="block text-brand-muted">{entry.date}</span>
          <span className="mt-1 block font-medium">{main}</span>
          <span className="mt-1 block font-mono font-semibold tabular-nums">{amountLabel}</span>
          <span className="mt-3 block text-brand-muted">
            이 사용내역을 삭제할까요? 삭제하면 복구할 수 없습니다.
          </span>
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="h-11 rounded-[12px] border border-brand-border px-4 text-base text-brand-ink disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="h-11 rounded-[12px] bg-[#b3261e] px-4 text-base font-medium text-white disabled:opacity-70"
          >
            {deleting ? "삭제 중…" : "삭제하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
