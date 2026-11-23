"use client";

import { formatWon } from "@/lib/expense-date";
import type { UserCardRow } from "@/lib/cards";
import type { DateRange } from "@/lib/expense-period";
import type { ExpenseRow } from "@/lib/supabase/client";

type Props = {
  range: DateRange;
  entries: ExpenseRow[];
  cards: UserCardRow[];
};

export function CardPeriodTotals({ range, entries, cards }: Props) {
  const allTotal = entries.reduce((s, e) => s + e.amount, 0);
  const perCard = cards.map((card) => {
    const rows = entries.filter((e) => e.card_id === card.id);
    return {
      card,
      total: rows.reduce((s, e) => s + e.amount, 0),
      count: rows.length,
    };
  });

  return (
    <div className="mb-3 rounded-[12px] border border-brand-border bg-brand-surface px-3 py-3">
      <p className="text-sm font-semibold text-brand-ink">기간별 카드 합계</p>
      <p className="mt-0.5 text-xs text-brand-muted">
        {range.start} ~ {range.end} · 승인 총액 기준(할부는 1건 전액)
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-brand-ink">
        <li className="flex justify-between gap-2">
          <span>전체 카드</span>
          <span className="font-mono tabular-nums">
            {formatWon(allTotal)} · {entries.length}건
          </span>
        </li>
        {perCard.map(({ card, total, count }) => (
          <li key={card.id} className="flex justify-between gap-2 text-brand-muted">
            <span>{card.display_name}</span>
            <span className="font-mono tabular-nums text-brand-ink">
              {formatWon(total)} · {count}건
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}