const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export function isValidConfirmedYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/** API 본문에서 사용자가 확인한 결제 연도 */
export function parseConfirmedYear(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const y = Math.trunc(value);
  return isValidConfirmedYear(y) ? y : null;
}

export const SMS_CONFIRMED_YEAR_MIN = MIN_YEAR;
export const SMS_CONFIRMED_YEAR_MAX = MAX_YEAR;
