"use client";

import type { CardFilter, UserCardRow } from "@/lib/cards";

type Props = {
  cards: UserCardRow[];
  value: CardFilter;
  onChange: (next: CardFilter) => void;
};

export function CardFilterChips({ cards, value, onChange }: Props) {
  return (
    <div
      className="mb-3 flex flex-wrap gap-2"
      role="group"
      aria-label="카드 필터"
    >
      <FilterChip
        active={value === "all"}
        onClick={() => onChange("all")}
        label="전체 카드"
      />
      {cards.map((card) => (
        <FilterChip
          key={card.id}
          active={value === card.code}
          onClick={() => onChange(card.code)}
          label={card.display_name}
        />
      ))}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-[10px] px-3 text-sm font-medium ${
        active
          ? "bg-brand-green text-white"
          : "border border-brand-border bg-brand-surface text-brand-ink"
      }`}
    >
      {label}
    </button>
  );
}