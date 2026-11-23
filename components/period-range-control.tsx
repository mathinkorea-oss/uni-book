"use client";

import type { PeriodPreset } from "@/lib/expense-period";
import { formatPeriodLabel, type DateRange } from "@/lib/expense-period";
import { addMonths, formatMonthLabel, type ViewMonth } from "@/lib/month";

type Props = {
  preset: PeriodPreset;
  viewMonth: ViewMonth;
  range: DateRange;
  customStart: string;
  customEnd: string;
  customError: string | null;
  onPresetChange: (preset: PeriodPreset) => void;
  onViewMonthChange: (vm: ViewMonth) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
};

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "this_month", label: "이번 달" },
  { id: "last_month", label: "지난달" },
  { id: "last_3_months", label: "최근 3개월" },
  { id: "month", label: "월별" },
  { id: "custom", label: "직접 선택" },
];

export function PeriodRangeControl({
  preset,
  viewMonth,
  range,
  customStart,
  customEnd,
  customError,
  onPresetChange,
  onViewMonthChange,
  onCustomStartChange,
  onCustomEndChange,
}: Props) {
  const periodCaption = formatPeriodLabel(preset, range, viewMonth);

  return (
    <div className="mb-3 space-y-2">
      <p className="text-xs text-brand-muted">
        기간 조회 (한국 시간) · {periodCaption}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPresetChange(p.id)}
            className={`h-10 min-w-[4.5rem] flex-1 rounded-[10px] px-2 text-sm sm:flex-none ${
              preset === p.id
                ? "bg-brand-green text-white"
                : "border border-brand-border bg-brand-surface text-brand-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "month" ? (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => onViewMonthChange(addMonths(viewMonth, -1))}
            aria-label="이전 달"
            className="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-brand-user-bubble"
          >
            ‹
          </button>
          <p className="min-w-[8.5rem] text-center text-base font-semibold">
            {formatMonthLabel(viewMonth)}
          </p>
          <button
            type="button"
            onClick={() => onViewMonthChange(addMonths(viewMonth, 1))}
            aria-label="다음 달"
            className="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-brand-user-bubble"
          >
            ›
          </button>
        </div>
      ) : null}

      {preset === "custom" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            시작일
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-muted">
            종료일
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
            />
          </label>
        </div>
      ) : null}

      {customError ? (
        <p className="text-sm text-[#b3261e]" role="alert">
          {customError}
        </p>
      ) : null}
    </div>
  );
}