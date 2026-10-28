/** YYYY-MM-DD 지출 날짜 — UTC 변환 없이 로컬 달력 기준 */
export function parseExpenseDateLocal(isoDate: string): Date {
  const parts = isoDate.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return new Date(NaN);
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function getWeekdayIndex(isoDate: string): number {
  const date = parseExpenseDateLocal(isoDate);
  return date.getDay();
}

export function formatDateWithWeekday(isoDate: string): string {
  const date = parseExpenseDateLocal(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const wd = WEEKDAY_KO[date.getDay()];
  return `${isoDate} (${wd})`;
}

/** 표시 순서: 월~일 */
export const WEEKDAY_DISPLAY_ORDER: { jsDay: number; label: string }[] = [
  { jsDay: 1, label: "월" },
  { jsDay: 2, label: "화" },
  { jsDay: 3, label: "수" },
  { jsDay: 4, label: "목" },
  { jsDay: 5, label: "금" },
  { jsDay: 6, label: "토" },
  { jsDay: 0, label: "일" },
];

export function sumByWeekdayInMonth(
  rows: { date: string; amount: number }[],
): Record<number, number> {
  const sums: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };
  for (const row of rows) {
    const idx = getWeekdayIndex(row.date);
    if (idx >= 0 && idx <= 6) {
      sums[idx] = (sums[idx] ?? 0) + row.amount;
    }
  }
  return sums;
}

export function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}
