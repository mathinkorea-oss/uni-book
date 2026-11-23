import {
  addMonths,
  getCurrentViewMonth,
  monthDateRange,
  type ViewMonth,
} from "@/lib/month";

export type PeriodPreset =
  | "month"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "custom";

export type DateRange = { start: string; end: string };

const KST = "Asia/Seoul";

export function kstYmdFromParts(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function kstTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function kstViewMonth(): ViewMonth {
  const parts = kstTodayYmd().split("-");
  return { year: Number(parts[0]), month: Number(parts[1]) };
}

export function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isReversedRange(start: string, end: string): boolean {
  return start > end;
}

export function isSingleCalendarMonth(range: DateRange): boolean {
  return range.start.slice(0, 7) === range.end.slice(0, 7);
}

export function formatPeriodLabel(
  preset: PeriodPreset,
  range: DateRange,
  viewMonth: ViewMonth | null,
): string {
  if (preset === "month" && viewMonth) {
    return `${viewMonth.year}년 ${viewMonth.month}월`;
  }
  if (preset === "this_month") return "이번 달";
  if (preset === "last_month") return "지난달";
  if (preset === "last_3_months") {
    return `최근 3개월 (${range.start} ~ ${range.end})`;
  }
  if (preset === "custom") {
    return `${range.start} ~ ${range.end}`;
  }
  return `${range.start} ~ ${range.end}`;
}

export function resolvePeriodRange(params: {
  preset: PeriodPreset;
  viewMonth: ViewMonth | null;
  customStart?: string;
  customEnd?: string;
}): { range: DateRange | null; error: string | null } {
  const todayVm = kstViewMonth();

  if (params.preset === "month") {
    if (!params.viewMonth) {
      return { range: null, error: "월을 선택해 주세요." };
    }
    return { range: monthDateRange(params.viewMonth), error: null };
  }

  if (params.preset === "this_month") {
    return { range: monthDateRange(todayVm), error: null };
  }

  if (params.preset === "last_month") {
    const prev = addMonths(todayVm, -1);
    return { range: monthDateRange(prev), error: null };
  }

  if (params.preset === "last_3_months") {
    const startMonth = addMonths(todayVm, -2);
    const start = monthDateRange(startMonth).start;
    const end = monthDateRange(todayVm).end;
    return { range: { start, end }, error: null };
  }

  if (params.preset === "custom") {
    const start = params.customStart?.trim() ?? "";
    const end = params.customEnd?.trim() ?? "";
    if (!start || !end) {
      return { range: null, error: "시작일과 종료일을 입력해 주세요." };
    }
    if (!parseYmd(start) || !parseYmd(end)) {
      return { range: null, error: "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)" };
    }
    if (isReversedRange(start, end)) {
      return { range: null, error: "종료일이 시작일보다 앞섭니다. 날짜를 바꿔 주세요." };
    }
    return { range: { start, end }, error: null };
  }

  return { range: null, error: "조회 기간을 선택해 주세요." };
}