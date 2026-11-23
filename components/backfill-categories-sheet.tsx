"use client";

import { useEffect, useState } from "react";
import type { BackfillScope } from "@/lib/backfill-categories";
import type { CardFilter } from "@/lib/cards";
import type { DateRange } from "@/lib/expense-period";
import { getCardLabel, type UserCardRow } from "@/lib/cards";

type Preview = {
  start: string;
  end: string;
  cardFilter: CardFilter;
  scope: BackfillScope;
  scopeLabel: string;
  targetCount: number;
  totalInRange: number;
  skippedUserSetCount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  range: DateRange;
  cardFilter: CardFilter;
  cards: UserCardRow[];
  onDone: (message: string) => void;
};

export function BackfillCategoriesSheet({
  open,
  onClose,
  range,
  cardFilter,
  cards,
  onDone,
}: Props) {
  const [scope, setScope] = useState<BackfillScope>("needs_review_only");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope("needs_review_only");
    setError(null);
    setPreview(null);
    void fetchPreview();
  }, [open, range.start, range.end, cardFilter, scope]);

  async function fetchPreview() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start: range.start,
        end: range.end,
        cardFilter,
        scope,
      });
      const res = await fetch(`/api/expenses/backfill-categories?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "미리보기에 실패했습니다.");
        return;
      }
      setPreview(data as Preview);
    } finally {
      setLoading(false);
    }
  }

  async function run() {
    if (!preview?.targetCount) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses/backfill-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: range.start,
          end: range.end,
          cardFilter,
          scope,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "실행에 실패했습니다.");
        return;
      }
      onDone(`${data.updated ?? 0}건에 규칙 기반 분류를 적용했습니다.`);
      onClose();
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  const cardLabel =
    cardFilter === "all"
      ? "전체 카드"
      : getCardLabel(cards, cards.find((c) => c.code === cardFilter)?.id);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 lg:items-center">
      <button type="button" className="absolute inset-0" aria-label="닫기" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-t-[16px] border border-brand-border bg-brand-surface p-4 lg:rounded-[16px]"
      >
        <h2 className="text-lg font-semibold text-brand-ink">
          규칙 기반 분류 실행
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          사용자가 직접 지정한 분류는 변경하지 않습니다.
        </p>
        <dl className="mt-3 space-y-1 text-sm text-brand-ink">
          <div className="flex justify-between gap-2">
            <dt className="text-brand-muted">기간</dt>
            <dd>
              {range.start} ~ {range.end}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-brand-muted">카드</dt>
            <dd>{cardLabel || cardFilter}</dd>
          </div>
        </dl>

        <fieldset className="mt-3 space-y-2">
          <legend className="text-sm font-medium text-brand-ink">대상</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="backfill-scope"
              checked={scope === "needs_review_only"}
              onChange={() => setScope("needs_review_only")}
            />
            <span>
              미분류·확인 필요만 (기타, 확인 플래그, 레거시 코드)
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="backfill-scope"
              checked={scope === "reapply_rules"}
              onChange={() => setScope("reapply_rules")}
            />
            <span>
              규칙 재적용 (이미 분류된 것 포함, 직접 지정 제외)
            </span>
          </label>
        </fieldset>

        <div className="mt-3 rounded-[10px] bg-brand-saved-bg px-3 py-2 text-sm">
          {loading ? (
            <p>대상 건수 계산 중…</p>
          ) : preview ? (
            <>
              <p>
                적용 예정 <strong>{preview.targetCount}건</strong> / 기간 내{" "}
                {preview.totalInRange}건
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                {preview.scopeLabel} · 직접 지정 제외 {preview.skippedUserSetCount}건
              </p>
            </>
          ) : (
            <p>미리보기를 불러오지 못했습니다.</p>
          )}
        </div>

        {error ? (
          <p className="mt-2 text-sm text-[#b3261e]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-[12px] border border-brand-border text-base"
          >
            취소
          </button>
          <button
            type="button"
            disabled={running || loading || !preview?.targetCount}
            onClick={() => void run()}
            className="h-12 flex-1 rounded-[12px] bg-brand-green text-base font-medium text-white disabled:opacity-60"
          >
            {running ? "실행 중…" : "분류 적용"}
          </button>
        </div>
      </div>
    </div>
  );
}