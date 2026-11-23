"use client";

import { useEffect, useRef, useState } from "react";
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

const SCOPE_OPTIONS: {
  id: BackfillScope;
  title: string;
  description: string;
}[] = [
  {
    id: "needs_review_only",
    title: "분류가 필요한 내역만",
    description: "기타 또는 확인이 필요한 내역을 분류합니다.",
  },
  {
    id: "reapply_rules",
    title: "이미 분류된 내역도 다시 분류",
    description: "직접 지정한 분류는 유지합니다.",
  },
];

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
  const scopeRef = useRef(scope);

  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    if (!open) return;
    setScope("needs_review_only");
    setError(null);
    setPreview(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const requestedScope = scope;
    const ac = new AbortController();
    let stale = false;

    setLoading(true);
    setError(null);
    setPreview(null);

    void (async () => {
      try {
        const params = new URLSearchParams({
          start: range.start,
          end: range.end,
          cardFilter,
          scope: requestedScope,
        });
        const res = await fetch(`/api/expenses/backfill-categories?${params}`, {
          signal: ac.signal,
        });
        const data = (await res.json()) as Preview & { error?: string };
        if (stale || scopeRef.current !== requestedScope) return;
        if (!res.ok) {
          setError(data.error ?? "미리보기에 실패했습니다.");
          setPreview(null);
          return;
        }
        setPreview(data);
      } catch (e) {
        if (stale || ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError("미리보기에 실패했습니다.");
        setPreview(null);
      } finally {
        if (!stale && scopeRef.current === requestedScope) {
          setLoading(false);
        }
      }
    })();

    return () => {
      stale = true;
      ac.abort();
    };
  }, [open, range.start, range.end, cardFilter, scope]);

  async function run() {
    if (loading || running || !preview || preview.scope !== scope) return;
    setRunning(true);
    setError(null);
    try {
      const runScope = scope;
      const res = await fetch("/api/expenses/backfill-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: range.start,
          end: range.end,
          cardFilter,
          scope: runScope,
        }),
      });
      const data = (await res.json()) as { updated?: number; error?: string };
      if (!res.ok) {
        setError(data.error ?? "자동 분류에 실패했습니다.");
        return;
      }
      onDone(`${data.updated ?? 0}건을 자동 분류했습니다.`);
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

  const previewReady =
    !loading && preview !== null && preview.scope === scope;
  const selectedOption = SCOPE_OPTIONS.find((o) => o.id === scope);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 lg:items-center">
      <button type="button" className="absolute inset-0" aria-label="닫기" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-t-[16px] border border-brand-border bg-brand-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-[16px]"
      >
        <h2 className="text-lg font-semibold text-brand-ink">자동 분류</h2>
        <p className="mt-1 text-sm text-brand-muted">
          가맹점 이름 등을 보고 분류합니다. 직접 지정한 분류는 유지합니다.
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
          <legend className="sr-only">자동 분류 대상</legend>
          {SCOPE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex min-h-12 cursor-pointer touch-manipulation items-start gap-3 rounded-[12px] border px-3 py-3 ${
                scope === opt.id
                  ? "border-brand-green bg-brand-saved-bg"
                  : "border-brand-border"
              }`}
            >
              <input
                type="radio"
                name="backfill-scope"
                checked={scope === opt.id}
                onChange={() => setScope(opt.id)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-green"
              />
              <span className="min-w-0 text-sm text-brand-ink">
                <span className="block font-medium">{opt.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-brand-muted">
                  {opt.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-3 rounded-[10px] bg-brand-saved-bg px-3 py-2 text-sm">
          {loading ? (
            <p>대상 건수를 계산하는 중…</p>
          ) : previewReady ? (
            <>
              <p>
                <strong>{selectedOption?.title}</strong> · 적용 예정{" "}
                <strong>{preview.targetCount}건</strong> / 기간 내{" "}
                {preview.totalInRange}건
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                {selectedOption?.description} 직접 지정한 내역{" "}
                {preview.skippedUserSetCount}건은 제외합니다.
              </p>
            </>
          ) : error ? (
            <p>미리보기를 불러오지 못했습니다.</p>
          ) : (
            <p>대상 건수를 불러오는 중…</p>
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
            disabled={
              running ||
              loading ||
              !previewReady ||
              (preview?.targetCount ?? 0) === 0
            }
            onClick={() => void run()}
            className="h-12 flex-1 rounded-[12px] bg-brand-green text-base font-medium text-white disabled:opacity-60"
          >
            {running ? "실행 중…" : "자동 분류 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}