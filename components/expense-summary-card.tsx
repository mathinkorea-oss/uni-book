"use client";

import type { CategoryCode } from "@/lib/categories";
import {
  formatAmountNumber,
  formatWon,
  WEEKDAY_DISPLAY_ORDER,
} from "@/lib/expense-date";
import { formatMonthLabel, type ViewMonth } from "@/lib/month";

type Props = {
  viewMonth: ViewMonth;
  monthTotal: number;
  entryCount: number;
  categoryFilter: CategoryCode | "all";
  filteredTotal: number;
  filteredCount: number;
  weekdaySums: Record<number, number>;
};

export function ExpenseSummaryCard({
  viewMonth,
  monthTotal,
  entryCount,
  categoryFilter,
  filteredTotal,
  filteredCount,
  weekdaySums,
}: Props) {
  const filterActive = categoryFilter !== "all";

  const weekdayAmounts = WEEKDAY_DISPLAY_ORDER.map(
    ({ jsDay }) => weekdaySums[jsDay] ?? 0,
  );
  const weekdayMax = weekdayAmounts.length
    ? Math.max(...weekdayAmounts, 0)
    : 0;

  return (
    <div className="mb-3 overflow-hidden rounded-[12px] border border-brand-border bg-brand-surface lg:flex lg:items-stretch">
      <section className="bg-brand-yellow px-4 py-4 sm:px-5 lg:min-w-0 lg:flex-1 lg:py-5">
        <p className="text-sm font-medium text-brand-ink">
          {formatMonthLabel(viewMonth)} 총 사용금액
        </p>
        <p className="mt-1.5 font-mono text-[clamp(1.75rem,8vw,2.25rem)] font-bold leading-none tabular-nums text-brand-ink">
          {formatAmountNumber(monthTotal)}
          <span className="ml-0.5 align-baseline text-[0.55em] font-semibold">
            원
          </span>
        </p>
        <p className="mt-1.5 text-sm text-brand-ink/85">
          총 {entryCount}건
        </p>
        {filterActive && (
          <p className="mt-2 text-sm text-brand-ink/80">
            선택 항목 기준 {formatWon(filteredTotal)} · {filteredCount}건
          </p>
        )}
      </section>

      <section className="border-t border-brand-border bg-brand-saved-bg px-4 py-3 sm:px-5 lg:flex-1 lg:border-l lg:border-t-0 lg:py-4">
        <div>
          <p className="text-sm font-semibold text-brand-ink">요일별 사용금액</p>
          <p className="mt-0.5 text-xs text-brand-muted">
            선택한 월 기준
            {filterActive ? " · 선택 항목 기준" : ""}
          </p>
        </div>
        <ul className="mt-2.5 space-y-0.5" aria-label="요일별 사용금액">
          {WEEKDAY_DISPLAY_ORDER.map(({ jsDay, label }) => {
            const amount = weekdaySums[jsDay] ?? 0;
            const isPeak = weekdayMax > 0 && amount === weekdayMax;
            const barPct =
              weekdayMax > 0 ? Math.round((amount / weekdayMax) * 100) : 0;

            return (
              <li
                key={label}
                className="grid h-[2rem] grid-cols-[1.125rem_minmax(0,1fr)_minmax(4.75rem,auto)] items-center gap-x-2 sm:h-[2.125rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_minmax(5.25rem,auto)] sm:gap-x-2.5"
              >
                <span
                  className={`text-sm text-brand-ink ${isPeak ? "font-bold" : "font-medium"}`}
                >
                  {label}
                </span>
                <div
                  className="h-2 min-w-0 rounded-full bg-[#e4ebe6]"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-brand-green"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span
                  className={`text-right font-mono text-[15px] tabular-nums leading-none text-brand-ink sm:text-base ${
                    isPeak ? "font-bold" : "font-semibold"
                  }`}
                >
                  {formatWon(amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
