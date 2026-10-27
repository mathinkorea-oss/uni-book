"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ExpenseRow, supabase } from "@/lib/supabase/client";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatKRW(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function parseAmountDigits(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return NaN;
  return Number(digits);
}

function formatAmountDisplay(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return formatKRW(Number(digits));
}

function descriptionForDb(description: string, note: string) {
  const main = description.trim();
  const extra = note.trim();
  if (!extra) return main;
  return `${main} (${extra})`;
}

function splitDescription(desc: string) {
  const match = desc.match(/^(.+?) \((.+)\)$/);
  if (match) return { main: match[1], note: match[2] };
  return { main: desc, note: undefined };
}

const cardClass =
  "rounded-xl border border-border-card bg-surface shadow-[var(--shadow-card)]";

const labelClass = "text-base font-medium text-foreground";

const fieldBase =
  "w-full min-w-0 rounded-lg border border-border-input bg-input-bg px-[14px] text-base text-foreground outline-none transition placeholder:text-placeholder focus:border-accent focus:ring-2 focus:ring-[var(--focus-ring)] disabled:opacity-60";

const inputClass = `${fieldBase} h-12`;

const amountInputClass = `${inputClass} pr-12 font-mono tabular-nums tracking-tight`;

const textareaClass = `${fieldBase} min-h-[96px] resize-y py-3`;

const amountBoldClass =
  "shrink-0 font-mono text-base font-semibold tabular-nums tracking-tight text-foreground";

type FieldErrors = {
  date?: string;
  amount?: string;
  description?: string;
};

export default function Home() {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<ExpenseRow[]>([]);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [monthKey, setMonthKey] = useState("");

  const monthTotal = useMemo(
    () =>
      monthKey
        ? entries
            .filter((e) => e.date.startsWith(monthKey))
            .reduce((sum, e) => sum + e.amount, 0)
        : 0,
    [entries, monthKey],
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("expenses")
      .select("id, created_at, date, amount, description")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(
        "지출 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setEntries([]);
    } else {
      setEntries(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setDate(todayISO());
    setMonthKey(currentMonthKey());
    void loadEntries();
  }, [loadEntries]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!date) errors.date = "날짜를 선택해 주세요.";
    const parsed = parseAmountDigits(amount);
    if (!amount.trim() || Number.isNaN(parsed) || parsed <= 0) {
      errors.amount = "0보다 큰 금액을 입력해 주세요.";
    }
    if (!description.trim()) {
      errors.description = "지출 내용을 입력해 주세요.";
    }
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setFormMessage(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const parsed = parseAmountDigits(amount);

    setSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        date,
        amount: parsed,
        description: descriptionForDb(description, note),
      })
      .select("id, created_at, date, amount, description")
      .single();

    setSaving(false);

    if (error || !data) {
      setFormMessage(
        "지출을 저장하지 못했습니다. 네트워크와 Supabase 설정을 확인해 주세요.",
      );
      return;
    }

    setEntries((prev) => [data, ...prev]);
    setAmount("");
    setDescription("");
    setNote("");
    setDate(todayISO());
    setFieldErrors({});
    setFormMessage("저장되었습니다.");
  }

  function handleAmountChange(value: string) {
    setAmount(formatAmountDisplay(value));
  }

  return (
    <div className="min-h-full w-full min-w-0 bg-background">
      <div
        className="mx-auto w-full max-w-[1040px] min-w-0 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:py-8"
      >
        <header className="mb-5">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground lg:text-[28px]">
            유니더 스마트 사용내역
          </h1>
        </header>

        <section
          className={`${cardClass} mb-6 px-5 py-4 sm:px-6`}
          aria-label="이번 달 지출 합계"
        >
          <p className="text-base text-muted">이번 달 지출 합계</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground lg:text-[28px]">
            {loading || !monthKey ? (
              <span className="font-sans text-base font-normal text-muted">
                불러오는 중…
              </span>
            ) : (
              <>
                {formatKRW(monthTotal)}
                <span className="ml-1 font-sans text-base font-medium text-muted">
                  원
                </span>
              </>
            )}
          </p>
        </section>

        <main
          className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8"
        >
          <section className="min-w-0" aria-label="지출 입력">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              지출 입력
            </h2>
            <div className={`${cardClass} min-w-0 p-5 sm:p-6`}>
              <form onSubmit={handleSubmit} className="flex flex-col">
                <div className="flex flex-col gap-4 sm:gap-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className={labelClass}>날짜</span>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                        className={inputClass}
                        aria-invalid={Boolean(fieldErrors.date)}
                        aria-describedby={
                          fieldErrors.date ? "date-error" : undefined
                        }
                        required
                        disabled={saving}
                      />
                      {fieldErrors.date && (
                        <p id="date-error" className="text-sm text-[#b3261e]">
                          {fieldErrors.date}
                        </p>
                      )}
                    </label>

                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className={labelClass}>금액</span>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={amount}
                          onChange={(e) => {
                            handleAmountChange(e.target.value);
                            setFieldErrors((prev) => ({
                              ...prev,
                              amount: undefined,
                            }));
                          }}
                          className={amountInputClass}
                          aria-invalid={Boolean(fieldErrors.amount)}
                          aria-describedby={
                            fieldErrors.amount ? "amount-error" : undefined
                          }
                          required
                          disabled={saving}
                        />
                        <span
                          className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-base text-muted"
                          aria-hidden
                        >
                          원
                        </span>
                      </div>
                      {fieldErrors.amount && (
                        <p id="amount-error" className="text-sm text-[#b3261e]">
                          {fieldErrors.amount}
                        </p>
                      )}
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>내용</span>
                    <input
                      type="text"
                      placeholder="예: 회의 식대, 소프트웨어 구독"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setFieldErrors((prev) => ({
                          ...prev,
                          description: undefined,
                        }));
                      }}
                      className={inputClass}
                      aria-invalid={Boolean(fieldErrors.description)}
                      aria-describedby={
                        fieldErrors.description ? "description-error" : undefined
                      }
                      required
                      disabled={saving}
                    />
                    {fieldErrors.description && (
                      <p
                        id="description-error"
                        className="text-sm text-[#b3261e]"
                      >
                        {fieldErrors.description}
                      </p>
                    )}
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>
                      참고{" "}
                      <span className="font-normal text-muted">(선택)</span>
                    </span>
                    <textarea
                      placeholder="추가로 남길 메모가 있으면 입력하세요"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className={textareaClass}
                      disabled={saving}
                    />
                  </label>
                </div>

                {formMessage && (
                  <p
                    role="status"
                    className={`mt-4 text-base ${
                      formMessage === "저장되었습니다."
                        ? "text-foreground"
                        : "text-[#b3261e]"
                    }`}
                  >
                    {formMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-5 h-12 w-full touch-manipulation rounded-lg bg-accent text-base font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "저장 중…" : "지출 저장"}
                </button>
              </form>
            </div>
          </section>

          <section className="min-w-0" aria-label="최근 내역">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              최근 내역
            </h2>
            <div className={`${cardClass} min-w-0 overflow-hidden`}>
              {loadError && (
                <p className="border-b border-border-card px-5 py-4 text-base text-[#b3261e] sm:px-6">
                  {loadError}
                </p>
              )}

              {loading ? (
                <p className="px-5 py-4 text-base text-muted sm:px-6">
                  불러오는 중…
                </p>
              ) : entries.length === 0 ? (
                <p className="px-5 py-6 text-base text-muted sm:px-6">
                  아직 등록된 지출이 없습니다.
                </p>
              ) : (
                <ul className="divide-y divide-border-card">
                  {entries.map((entry) => {
                    const { main, note: entryNote } = splitDescription(
                      entry.description,
                    );
                    return (
                      <li
                        key={entry.id}
                        className="flex min-w-0 items-start justify-between gap-4 px-5 py-4 sm:px-6"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-base leading-snug text-foreground">
                            {main}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {entry.date}
                            {entryNote ? ` · ${entryNote}` : ""}
                          </p>
                        </div>
                        <span className={amountBoldClass}>
                          {formatKRW(entry.amount)}원
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
