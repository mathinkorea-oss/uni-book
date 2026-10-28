"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeleteExpenseDialog } from "@/components/delete-expense-dialog";
import { ExpandToggleButton } from "@/components/expand-toggle-button";
import { ExpenseEditSheet } from "@/components/expense-edit-sheet";
import { ExpenseSummaryCard } from "@/components/expense-summary-card";
import {
  CATEGORY_GROUPS,
  type CategoryCode,
  getCategoryLabel,
  isCategoryCode,
} from "@/lib/categories";
import {
  buildReorderPayload,
  sortExpenses,
  type SortMode,
} from "@/lib/expense-sort";
import { expenseTextParts } from "@/lib/expense-parse";
import {
  formatDateWithWeekday,
  sumByWeekdayInMonth,
} from "@/lib/expense-date";
import {
  addMonths,
  formatMonthLabel,
  getCurrentViewMonth,
  isCurrentMonth,
  isSameMonth,
  monthDateRange,
  viewMonthFromExpenseDate,
  type ViewMonth,
} from "@/lib/month";
import { EXPENSE_SELECT, type ExpenseRow, supabase } from "@/lib/supabase/client";
import {
  readUiPref,
  UI_PREF_KEYS,
  writeUiPref,
} from "@/lib/ui-prefs";

const MOBILE_COLLAPSED = 3;
const EXPENSE_LIST_ID = "expense-usage-list";

export type UsageSectionHandle = {
  reload: () => Promise<void>;
  getSortMode: () => SortMode;
};

type Props = {
  savedOtherMonth: ViewMonth | null;
  onSavedOtherMonthChange: (vm: ViewMonth | null) => void;
  onMonthMovedNotice: (vm: ViewMonth) => void;
  onReady: (handle: UsageSectionHandle) => void;
};

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CategoryBadge({
  code,
  needsReview,
}: {
  code: string | null | undefined;
  needsReview?: boolean | null;
}) {
  const label = getCategoryLabel(code);
  if (needsReview) {
    return (
      <span
        className="inline-flex rounded-md bg-brand-yellow px-1.5 py-0.5 text-xs font-medium text-brand-ink"
      >
        {label} · 확인
      </span>
    );
  }
  return (
    <span
      className="inline-flex rounded-md bg-[#e4f0e8] px-1.5 py-0.5 text-xs font-medium text-brand-green"
    >
      {label}
    </span>
  );
}

function SortableRow({
  entry,
  manualMode,
  filterActive,
  onEdit,
  onDelete,
  deleteConfirmOpen,
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
}: {
  entry: ExpenseRow;
  manualMode: boolean;
  filterActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleteConfirmOpen: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const { main, note } = expenseTextParts(entry);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: !manualMode || filterActive });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`w-full min-w-0 rounded-[12px] border border-brand-border bg-brand-surface px-3 py-2.5 ${
        isDragging ? "bg-brand-user-bubble ring-2 ring-brand-green" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {manualMode && !filterActive && (
          <button
            type="button"
            className="mt-0.5 flex h-10 w-8 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-md text-brand-muted active:cursor-grabbing"
            aria-label="순서 변경 핸들"
            {...attributes}
            {...listeners}
          >
            ≡
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-snug text-brand-ink sm:text-base">
              {main}
            </p>
            <p className="max-w-[45%] shrink-0 text-right font-mono text-[0.9375rem] font-bold tabular-nums leading-tight text-brand-ink sm:text-base">
              {new Intl.NumberFormat("ko-KR").format(entry.amount)}원
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <CategoryBadge
              code={entry.category_code}
              needsReview={entry.category_needs_review}
            />
            <p className="text-xs text-brand-muted sm:text-sm">
              {formatDateWithWeekday(entry.date)}
            </p>
          </div>
          {note ? (
            <p className="mt-0.5 text-xs text-brand-muted sm:text-sm">{note}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-brand-green hover:bg-brand-user-bubble"
            aria-label="사용내역 수정"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-brand-user-bubble ${
              deleteConfirmOpen ? "text-[#b3261e]" : "text-brand-muted"
            }`}
            aria-label="사용내역 삭제"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      {manualMode && !filterActive && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={disableUp}
            onClick={onMoveUp}
            className="flex-1 rounded-[8px] border border-brand-border py-1 text-xs disabled:opacity-40"
          >
            위로 이동
          </button>
          <button
            type="button"
            disabled={disableDown}
            onClick={onMoveDown}
            className="flex-1 rounded-[8px] border border-brand-border py-1 text-xs disabled:opacity-40"
          >
            아래로 이동
          </button>
        </div>
      )}
    </li>
  );
}

export function ExpenseUsageSection({
  savedOtherMonth,
  onSavedOtherMonthChange,
  onMonthMovedNotice,
  onReady,
}: Props) {
  const [viewMonth, setViewMonth] = useState<ViewMonth | null>(null);
  const [entries, setEntries] = useState<ExpenseRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [categoryFilter, setCategoryFilter] = useState<CategoryCode | "all">(
    "all",
  );
  const [listExpanded, setListExpanded] = useState(false);
  const [editEntry, setEditEntry] = useState<ExpenseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [weekdayExpanded, setWeekdayExpanded] = useState(false);
  const [usageListVisible, setUsageListVisible] = useState(true);
  const listTopRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 280, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadEntriesForMonth = useCallback(async (vm: ViewMonth) => {
    setLoadingList(true);
    setListError(null);
    const { start, end } = monthDateRange(vm);
    const { data, error } = await supabase
      .from("expenses")
      .select(EXPENSE_SELECT)
      .gte("date", start)
      .lte("date", end);

    if (error) {
      setListError(
        error.message.includes("column")
          ? "DB 마이그레이션이 필요합니다. supabase/migrations SQL을 실행해 주세요."
          : "사용내역을 불러오지 못했습니다.",
      );
      setEntries([]);
    } else {
      setEntries(data ?? []);
    }
    setLoadingList(false);
  }, []);

  const reload = useCallback(async () => {
    if (viewMonth) await loadEntriesForMonth(viewMonth);
  }, [loadEntriesForMonth, viewMonth]);

  useEffect(() => {
    setViewMonth((prev) => prev ?? getCurrentViewMonth());
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) {
        setWeekdayExpanded(
          readUiPref(id, UI_PREF_KEYS.weekdayExpanded, false),
        );
        setUsageListVisible(
          readUiPref(id, UI_PREF_KEYS.usageListVisible, true),
        );
      }
    });
  }, []);

  useEffect(() => {
    if (viewMonth) void loadEntriesForMonth(viewMonth);
  }, [viewMonth, loadEntriesForMonth]);

  useEffect(() => {
    onReady({
      reload,
      getSortMode: () => sortMode,
    });
  }, [onReady, reload, sortMode]);

  const sorted = useMemo(
    () => sortExpenses(entries, sortMode),
    [entries, sortMode],
  );

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return sorted;
    return sorted.filter(
      (e) => (isCategoryCode(e.category_code ?? "") ? e.category_code : "other") === categoryFilter,
    );
  }, [sorted, categoryFilter]);

  const monthTotal = entries.reduce((s, e) => s + e.amount, 0);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  const weekdaySource = categoryFilter === "all" ? entries : filtered;
  const weekdaySums = useMemo(
    () => sumByWeekdayInMonth(weekdaySource),
    [weekdaySource],
  );

  const showFullList =
    sortMode === "manual" ||
    listExpanded ||
    filtered.length <= MOBILE_COLLAPSED;

  const displayList = useMemo(() => {
    if (showFullList) return filtered;
    return filtered.slice(0, MOBILE_COLLAPSED);
  }, [filtered, showFullList]);

  const showExpandToggle =
    usageListVisible &&
    sortMode !== "manual" &&
    filtered.length > MOBILE_COLLAPSED;

  const setWeekdayExpandedPersist = useCallback(
    (expanded: boolean) => {
      setWeekdayExpanded(expanded);
      writeUiPref(userId, UI_PREF_KEYS.weekdayExpanded, expanded);
    },
    [userId],
  );

  const toggleUsageListVisible = useCallback(() => {
    if (sortMode === "manual") return;
    setUsageListVisible((prev) => {
      const next = !prev;
      if (next) setListExpanded(false);
      writeUiPref(userId, UI_PREF_KEYS.usageListVisible, next);
      return next;
    });
  }, [userId, sortMode]);

  function toggleListExpanded() {
    if (sortMode === "manual") return;
    setListExpanded((prev) => {
      const next = !prev;
      if (prev) {
        requestAnimationFrame(() => {
          listTopRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
      return next;
    });
  }

  function goToMonth(vm: ViewMonth) {
    setViewMonth(vm);
    setListExpanded(false);
    onSavedOtherMonthChange(null);
  }

  async function persistOrder(ordered: ExpenseRow[]) {
    const payload = buildReorderPayload(ordered);
    const prev = [...entries];
    setEntries(ordered);
    setReorderError(null);
    const res = await fetch("/api/expenses/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload }),
    });
    if (!res.ok) {
      setEntries(prev);
      setReorderError("순서를 저장하지 못했습니다. 이전 순서로 복원했습니다.");
    }
  }

  async function ensureManualSortInitialized() {
    const ordered = sortExpenses(entries, "date");
    const withOrder = ordered.map((row, i) => ({ ...row, sort_order: i }));
    setEntries(withOrder);
    await persistOrder(withOrder);
  }

  async function handleSortModeChange(mode: SortMode) {
    if (mode === "manual") {
      setSortMode(mode);
      setUsageListVisible(true);
      writeUiPref(userId, UI_PREF_KEYS.usageListVisible, true);
      setListExpanded(true);
      if (entries.length && entries.some((e) => e.sort_order == null)) {
        await ensureManualSortInitialized();
      }
    } else {
      setSortMode(mode);
      setUsageListVisible(true);
      writeUiPref(userId, UI_PREF_KEYS.usageListVisible, true);
      setListExpanded(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (categoryFilter !== "all" || sortMode !== "manual") return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((e) => e.id === active.id);
    const newIndex = sorted.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(arrayMove(sorted, oldIndex, newIndex));
  }

  function moveRow(id: string, dir: -1 | 1) {
    if (categoryFilter !== "all") return;
    const idx = sorted.findIndex((e) => e.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    void persistOrder(arrayMove(sorted, idx, target));
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const targetId = deleteTarget.id;
    setDeleting(true);
    setDeleteError(null);
    setDeleteSuccessMsg(null);
    try {
      const res = await fetch(`/api/expenses/${targetId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { deleted?: boolean; error?: string };
      if (!res.ok || !data.deleted) {
        setDeleteError(
          data.error ??
            "삭제에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.",
        );
        return;
      }
      setDeleteTarget(null);
      setDeleteSuccessMsg("삭제되었습니다.");
      if (editEntry?.id === targetId) setEditEntry(null);
      await reload();
    } catch {
      setDeleteError(
        "삭제에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function runBackfill() {
    setBackfillMsg(null);
    const res = await fetch("/api/expenses/backfill-categories", {
      method: "POST",
    });
    const data = (await res.json()) as { updated?: number; error?: string };
    if (!res.ok) {
      setBackfillMsg(data.error ?? "자동 분류에 실패했습니다.");
      return;
    }
    setBackfillMsg(`${data.updated ?? 0}건 분류를 갱신했습니다.`);
    await reload();
  }

  if (!viewMonth) {
    return (
      <div className="bg-brand-saved-bg px-4 py-4 text-sm text-brand-muted">
        불러오는 중…
      </div>
    );
  }

  const usageTitle = isCurrentMonth(viewMonth)
    ? "이번 달 사용내역"
    : "선택한 달의 사용내역";

  return (
    <div className="bg-brand-saved-bg px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-brand-ink">{usageTitle}</h2>
        <div className="flex flex-wrap gap-2">
          {!isCurrentMonth(viewMonth) && (
            <button
              type="button"
              onClick={() => goToMonth(getCurrentViewMonth())}
              className="rounded-[10px] border border-brand-border bg-brand-surface px-2.5 py-1.5 text-sm text-brand-green"
            >
              이번 달
            </button>
          )}
          <button
            type="button"
            onClick={() => void runBackfill()}
            className="rounded-[10px] border border-brand-border bg-brand-surface px-2.5 py-1.5 text-sm text-brand-muted"
          >
            기존 내역 자동 분류
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => goToMonth(addMonths(viewMonth, -1))}
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
          onClick={() => goToMonth(addMonths(viewMonth, 1))}
          aria-label="다음 달"
          className="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-brand-user-bubble"
        >
          ›
        </button>
      </div>

      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => void handleSortModeChange("date")}
          className={`h-10 flex-1 rounded-[10px] px-2 text-sm ${
            sortMode === "date"
              ? "bg-brand-green text-white"
              : "border border-brand-border bg-brand-surface text-brand-ink"
          }`}
        >
          날짜순
        </button>
        <button
          type="button"
          onClick={() => void handleSortModeChange("manual")}
          className={`h-10 flex-1 rounded-[10px] px-2 text-sm ${
            sortMode === "manual"
              ? "bg-brand-green text-white"
              : "border border-brand-border bg-brand-surface text-brand-ink"
          }`}
        >
          직접 정렬
        </button>
      </div>

      <label className="mb-2 flex flex-col gap-1 text-sm text-brand-muted">
        항목 필터
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as CategoryCode | "all");
            setListExpanded(false);
          }}
          className="h-10 rounded-[10px] border border-brand-border bg-brand-surface px-3 text-base text-brand-ink"
        >
          <option value="all">전체 항목</option>
          {CATEGORY_GROUPS.flatMap((g) =>
            g.codes.map((c) => (
              <option key={c} value={c}>
                {getCategoryLabel(c)}
              </option>
            )),
          )}
        </select>
      </label>

      {categoryFilter !== "all" && sortMode === "manual" && (
        <p className="mb-2 text-sm text-brand-muted">
          전체 항목에서 순서를 변경할 수 있습니다.
        </p>
      )}

      {!loadingList && !listError && (
        <ExpenseSummaryCard
          viewMonth={viewMonth}
          monthTotal={monthTotal}
          entryCount={entries.length}
          categoryFilter={categoryFilter}
          filteredTotal={filteredTotal}
          filteredCount={filtered.length}
          weekdaySums={weekdaySums}
          weekdayExpanded={weekdayExpanded}
          onWeekdayExpandedChange={setWeekdayExpandedPersist}
        />
      )}

      {savedOtherMonth && !isSameMonth(savedOtherMonth, viewMonth) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-brand-border bg-brand-surface px-3 py-2 text-sm">
          <span>{formatMonthLabel(savedOtherMonth)}에 저장했습니다.</span>
          <button
            type="button"
            onClick={() => goToMonth(savedOtherMonth)}
            className="rounded-[10px] bg-brand-green px-3 py-1.5 text-white"
          >
            그 달 보기
          </button>
        </div>
      )}

      {reorderError && (
        <p className="mb-2 text-sm text-[#b3261e]" role="alert">{reorderError}</p>
      )}
      {backfillMsg && (
        <p className="mb-2 text-sm text-brand-muted" role="status">{backfillMsg}</p>
      )}
      {deleteSuccessMsg && (
        <p className="mb-2 text-sm font-medium text-brand-green" role="status">
          {deleteSuccessMsg}
        </p>
      )}
      {deleteError && (
        <p className="mb-2 text-sm text-[#b3261e]" role="alert">{deleteError}</p>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-brand-ink">최근 사용내역</h3>
          <p className="text-xs text-brand-muted">
            {loadingList ? "…" : `${filtered.length}건`}
          </p>
        </div>
        {sortMode !== "manual" && (
          <ExpandToggleButton
            expanded={usageListVisible}
            onToggle={toggleUsageListVisible}
            controlsId={EXPENSE_LIST_ID}
          />
        )}
      </div>

      {sortMode === "manual" && (
        <p className="mb-2 text-xs leading-relaxed text-brand-muted">
          직접 정렬 중에는 목록을 숨길 수 없어요. 날짜순으로 바꾸면 다시 접을 수
          있습니다.
        </p>
      )}

      {usageListVisible && loadingList ? (
        <p className="text-sm text-brand-muted">불러오는 중…</p>
      ) : usageListVisible && listError ? (
        <p className="text-sm text-[#b3261e]">{listError}</p>
      ) : usageListVisible && filtered.length === 0 ? (
        <p className="text-sm text-brand-muted">
          아직 기록이 없어요. 첫 사용내역을 남겨보세요.
        </p>
      ) : null}

      <div id={EXPENSE_LIST_ID} ref={listTopRef}>
        {usageListVisible && !loadingList && !listError && filtered.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayList.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-1.5">
              {displayList.map((entry) => (
                <SortableRow
                  key={entry.id}
                  entry={entry}
                  manualMode={sortMode === "manual"}
                  filterActive={categoryFilter !== "all"}
                  onEdit={() => {
                    setDeleteError(null);
                    setEditEntry(entry);
                  }}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleteSuccessMsg(null);
                    setDeleteTarget(entry);
                  }}
                  deleteConfirmOpen={deleteTarget?.id === entry.id}
                  onMoveUp={() => moveRow(entry.id, -1)}
                  onMoveDown={() => moveRow(entry.id, 1)}
                  disableUp={sorted.findIndex((e) => e.id === entry.id) === 0}
                  disableDown={
                    sorted.findIndex((e) => e.id === entry.id) ===
                    sorted.length - 1
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        ) : null}
      </div>

      {showExpandToggle && (
        <button
          type="button"
          onClick={toggleListExpanded}
          aria-expanded={listExpanded}
          aria-controls={EXPENSE_LIST_ID}
          className="mt-2 w-full rounded-[10px] border border-brand-border bg-brand-surface py-2 text-sm text-brand-green"
        >
          {listExpanded
            ? "접기 · 3건만 보기"
            : `전체 내역 보기 · ${filtered.length}건`}
        </button>
      )}

      <DeleteExpenseDialog
        entry={deleteTarget}
        open={Boolean(deleteTarget)}
        deleting={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />

      <ExpenseEditSheet
        entry={editEntry}
        open={Boolean(editEntry)}
        onClose={() => setEditEntry(null)}
        onSaved={(expense, previousDate) => {
          const prevVm = viewMonthFromExpenseDate(previousDate);
          const nextVm = viewMonthFromExpenseDate(expense.date);
          if (nextVm && prevVm && !isSameMonth(prevVm, nextVm)) {
            onMonthMovedNotice(nextVm);
            goToMonth(nextVm);
          } else {
            void reload();
          }
        }}
      />
    </div>
  );
}
