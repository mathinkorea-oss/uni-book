export type ViewMonth = {
  year: number;
  month: number;
};

export function getCurrentViewMonth(): ViewMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function formatMonthLabel(vm: ViewMonth) {
  return `${vm.year}년 ${vm.month}월`;
}

export function isSameMonth(a: ViewMonth, b: ViewMonth) {
  return a.year === b.year && a.month === b.month;
}

export function isCurrentMonth(vm: ViewMonth) {
  return isSameMonth(vm, getCurrentViewMonth());
}

export function addMonths(vm: ViewMonth, delta: number): ViewMonth {
  const d = new Date(vm.year, vm.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthDateRange(vm: ViewMonth) {
  const mm = String(vm.month).padStart(2, "0");
  const start = `${vm.year}-${mm}-01`;
  const lastDay = new Date(vm.year, vm.month, 0).getDate();
  const end = `${vm.year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function viewMonthFromExpenseDate(dateStr: string): ViewMonth | null {
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month || month < 1 || month > 12) return null;
  return { year, month };
}
