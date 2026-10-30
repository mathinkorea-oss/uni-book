"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_GROUPS,
  type CategoryCode,
  getCategoryLabel,
} from "@/lib/categories";
import { formatDateWithWeekday } from "@/lib/expense-date";
import { buildExpenseDateIso } from "@/lib/parse-shinhan-sms";
import type { ExpenseRow } from "@/lib/supabase/client";

type DuplicateRow = {
  id: string;
  date: string;
  amount: number;
  description: string;
  payment_time?: string | null;
};

type AnalyzeResult = {
  fingerprint: string;
  suggestedYear: number;
  date: string;
  dateLabel: string;
  time: string;
  amount: number;
  merchant: string;
  category_code: CategoryCode;
  category_label: string;
  category_needs_review: boolean;
  exactDuplicate?: DuplicateRow | null;
  duplicateReason?: "same_sms_text" | "same_payment_different_format" | null;
  fuzzyCandidates?: DuplicateRow[];
  previouslyDeleted?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  getSortMode: () => "date" | "manual";
  onSaved: (expense: ExpenseRow, date: string) => void;
};

function koreaYearNow() {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date()),
  );
}

export function CardSmsSheet({ open, onClose, getSortMode, onSaved }: Props) {
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<"paste" | "preview" | "notice">("paste");
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeExpense, setNoticeExpense] = useState<DuplicateRow | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [year, setYear] = useState(2026);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<CategoryCode>("other");
  const [categoryUserSet, setCategoryUserSet] = useState(false);
  const [fuzzyCandidates, setFuzzyCandidates] = useState<DuplicateRow[]>([]);
  const [pendingReRegister, setPendingReRegister] = useState(false);
  const [reRegisterPrompt, setReRegisterPrompt] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("paste");
    setRawText("");
    setAnalysis(null);
    setNotice(null);
    setNoticeExpense(null);
    setFuzzyCandidates([]);
    setPendingReRegister(false);
    setReRegisterPrompt(false);
    setError(null);
    setYear(koreaYearNow());
  }, [open]);

  const dateLabel = useMemo(() => {
    if (!date) return "";
    return formatDateWithWeekday(date);
  }, [date]);

  function applyYearToDate(nextYear: number) {
    const parts = date.split("-");
    if (parts.length !== 3) return;
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const built = buildExpenseDateIso(nextYear, m, d);
    if (built) setDate(built);
    else setError("존재하지 않는 날짜입니다.");
  }

  async function handleAnalyze() {
    if (analyzing) return;
    setError(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/expenses/sms/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, year }),
      });
      const data = await res.json();
      if (data.parseError) {
        setError(data.parseError.message);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "분석에 실패했습니다.");
        return;
      }
      const result = data as AnalyzeResult;
      if (result.exactDuplicate) {
        setNotice(
          result.duplicateReason === "same_payment_different_format"
            ? "같은 결제로 이미 저장된 내역입니다. (문자 형식만 다를 수 있습니다.)"
            : "이미 저장된 사용내역입니다.",
        );
        setNoticeExpense(result.exactDuplicate);
        setStep("notice");
        return;
      }
      setAnalysis(result);
      setDate(result.date);
      setTime(result.time);
      setAmount(String(result.amount));
      setMerchant(result.merchant);
      setCategory(result.category_code);
      setCategoryUserSet(false);
      setFuzzyCandidates(result.fuzzyCandidates ?? []);
      setPendingReRegister(Boolean(result.previouslyDeleted));
      setStep("preview");
    } catch {
      setError("분석에 실패했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function savePayload(extra: Record<string, unknown> = {}) {
    if (!analysis || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses/sms/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          fingerprint: analysis.fingerprint,
          confirmedYear: year,
          date,
          amount: Number(amount.replace(/[^\d]/g, "")),
          description: merchant,
          note,
          category_code: category,
          category_user_set: categoryUserSet,
          payment_time: time,
          sortMode: getSortMode(),
          ...extra,
        }),
      });
      const data = await res.json();

      if (data.linked && data.expense) {
        onSaved(data.expense as ExpenseRow, date);
        onClose();
        return;
      }

      if (data.duplicate) {
        setNotice(
          data.semanticDuplicate
            ? "같은 결제로 이미 저장된 내역입니다. (문자 형식만 다를 수 있습니다.)"
            : (data.message ?? "이미 저장된 사용내역입니다."),
        );
        setNoticeExpense(data.expense ?? null);
        setStep("notice");
        return;
      }
      if (data.needsFuzzyConfirm) {
        setFuzzyCandidates(data.fuzzyCandidates ?? []);
        setError(
          "같은 날·같은 금액의 기존 기록이 있습니다. 아래에서 선택해 주세요.",
        );
        return;
      }
      if (data.needsReRegisterConfirm) {
        setReRegisterPrompt(true);
        setPendingReRegister(true);
        setError(data.message);
        return;
      }
      if (!res.ok || !data.saved || !data.expense) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved(data.expense as ExpenseRow, date);
      onClose();
    } catch {
      setError("저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-sms-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[16px] border border-brand-border bg-brand-surface sm:rounded-[16px]"
      >
        <div className="shrink-0 border-b border-brand-border px-4 py-3">
          <h2 id="card-sms-title" className="text-lg font-semibold text-brand-ink">
            카드 문자 붙여넣기
          </h2>
          <p className="mt-0.5 text-sm text-brand-muted">
            한 번에 한 건만 등록합니다. 저장 전에 꼭 확인해 주세요.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step === "paste" && (
            <>
              <label className="flex flex-col gap-1.5 text-sm text-brand-muted">
                승인 문자
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={8}
                  className="min-h-[10rem] resize-y rounded-[12px] border border-brand-border px-3.5 py-3 text-base leading-normal text-brand-ink placeholder:text-[#737B75] outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
                  placeholder="복사한 신한 법인카드 승인 문자를 붙여넣으세요"
                />
              </label>
              {error && (
                <p className="mt-2 text-sm text-[#b3261e]" role="alert">
                  {error}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 flex-1 rounded-[12px] border border-brand-border text-base text-brand-ink"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={!rawText.trim() || analyzing}
                  onClick={() => void handleAnalyze()}
                  className="h-11 flex-1 rounded-[12px] bg-brand-green text-base font-medium text-white disabled:opacity-60"
                >
                  {analyzing ? "분석 중…" : "내용 확인"}
                </button>
              </div>
            </>
          )}

          {step === "notice" && (
            <div className="rounded-[12px] border border-brand-border bg-brand-saved-bg px-3 py-3">
              <p className="text-sm font-medium text-brand-ink">{notice}</p>
              {noticeExpense && (
                <p className="mt-2 break-words text-sm text-brand-muted">
                  {noticeExpense.date}
                  {noticeExpense.payment_time
                    ? ` ${noticeExpense.payment_time}`
                    : ""}{" "}
                  · {noticeExpense.description} ·{" "}
                  {new Intl.NumberFormat("ko-KR").format(noticeExpense.amount)}원
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mt-3 h-11 w-full rounded-[12px] bg-brand-green text-base font-medium text-white"
              >
                닫기
              </button>
            </div>
          )}

          {step === "preview" && analysis && (
            <>
              {pendingReRegister && (
                <p className="mb-3 rounded-[10px] border border-brand-border bg-brand-saved-bg px-3 py-2 text-sm text-brand-ink">
                  이전에 삭제한 내역과 같은 승인 문자입니다.
                  {reRegisterPrompt
                    ? " 아래 ‘다시 등록’을 눌러 주세요."
                    : " 저장 시 다시 확인합니다."}
                </p>
              )}

              <p className="mb-3 rounded-[10px] bg-brand-yellow/40 px-3 py-2 text-sm text-brand-ink">
                문자에 연도가 없어 확인이 필요합니다. 기본 제안: {analysis.suggestedYear}년
              </p>

              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-sm text-brand-muted">
                  결제 연도
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      setYear(y);
                      applyYearToDate(y);
                    }}
                    className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-muted">
                  결제 날짜
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
                  />
                  {dateLabel && (
                    <span className="text-xs text-brand-muted">{dateLabel}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-muted">
                  결제 시간
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-muted">
                  가맹점
                  <input
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="min-h-11 rounded-[10px] border border-brand-border px-3 py-2 text-base break-words text-brand-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-muted">
                  사용금액
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11 rounded-[10px] border border-brand-border px-3 text-base tabular-nums text-brand-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-muted">
                  분류 (제안)
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as CategoryCode);
                      setCategoryUserSet(true);
                    }}
                    className="h-11 rounded-[10px] border border-brand-border px-3 text-base text-brand-ink"
                  >
                    {CATEGORY_GROUPS.flatMap((g) =>
                      g.codes.map((c) => (
                        <option key={c} value={c}>
                          {getCategoryLabel(c)}
                        </option>
                      )),
                    )}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-brand-muted">
                  메모 (선택)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="사용 목적, 참석자 등"
                    className="rounded-[10px] border border-brand-border px-3 py-2 text-base text-brand-ink"
                  />
                </label>
              </div>

              {fuzzyCandidates.length > 0 && (
                <div className="mt-4 rounded-[12px] border border-brand-border bg-brand-saved-bg px-3 py-3">
                  <p className="text-sm font-medium text-brand-ink">
                    중복 의심 기록
                  </p>
                  <p className="mt-1 text-xs text-brand-muted">
                    날짜·금액이 같고 가맹점이 유사합니다. 같은 결제인지 확인해 주세요.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {fuzzyCandidates.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-[10px] border border-brand-border bg-brand-surface px-2 py-2 text-sm"
                      >
                        <p className="break-words text-brand-ink">
                          {c.description} ·{" "}
                          {new Intl.NumberFormat("ko-KR").format(c.amount)}원
                        </p>
                        <p className="text-xs text-brand-muted">
                          {c.date}
                          {c.payment_time ? ` ${c.payment_time}` : ""}
                        </p>
                        <div className="mt-2 flex flex-col gap-1 sm:flex-row">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void savePayload({
                                action: "link",
                                linkExpenseId: c.id,
                              })
                            }
                            className="h-11 flex-1 rounded-[10px] border border-brand-border text-sm text-brand-green"
                          >
                            기존 기록과 같은 결제
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void savePayload({ confirmSeparate: true })
                            }
                            className="h-11 flex-1 rounded-[10px] border border-brand-border text-sm text-brand-ink"
                          >
                            별도 결제로 저장
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p className="mt-3 text-sm text-brand-ink" role="status">
                  {error}
                </p>
              )}

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setStep("paste");
                    setError(null);
                    setReRegisterPrompt(false);
                  }}
                  className="h-11 flex-1 rounded-[12px] border border-brand-border text-base text-brand-ink"
                >
                  취소
                </button>
                {reRegisterPrompt ? (
                  <button
                    type="button"
                    disabled={saving || fuzzyCandidates.length > 0}
                    onClick={() =>
                      void savePayload({ confirmReRegister: true })
                    }
                    className="h-11 flex-1 rounded-[12px] bg-brand-green text-base font-medium text-white disabled:opacity-60"
                  >
                    {saving ? "저장 중…" : "다시 등록"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving || fuzzyCandidates.length > 0}
                    onClick={() => void savePayload()}
                    className="h-11 flex-1 rounded-[12px] bg-brand-green text-base font-medium text-white disabled:opacity-60"
                  >
                    {saving ? "저장 중…" : "저장"}
                  </button>
                )}
              </div>
              {fuzzyCandidates.length > 0 && (
                <p className="mt-2 text-xs text-brand-muted">
                  중복 의심이 있으면 위에서 선택하거나, 취소 후 내용을 확인해 주세요.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
