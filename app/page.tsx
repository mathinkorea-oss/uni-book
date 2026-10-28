"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExpenseUsageSection,
  type UsageSectionHandle,
} from "@/components/expense-usage-section";
import { LogoutButton } from "@/components/logout-button";
import {
  formatMonthLabel,
  viewMonthFromExpenseDate,
  type ViewMonth,
} from "@/lib/month";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  savedSuccess?: boolean;
};

const WELCOME =
  "법카 사용내역을 한 줄로 남겨보세요.\n예: 오늘 교재 구입 26,500원";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savedOtherMonth, setSavedOtherMonth] = useState<ViewMonth | null>(null);
  const [monthMovedNotice, setMonthMovedNotice] = useState<ViewMonth | null>(
    null,
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const usageRef = useRef<UsageSectionHandle | null>(null);

  const handleUsageReady = useCallback((handle: UsageSectionHandle) => {
    usageRef.current = handle;
  }, []);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME,
      },
    ]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setSending(true);

    const sortMode = usageRef.current?.getSortMode() ?? "date";

    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sortMode,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        expenseSaved?: boolean;
        extracted?: { date?: string };
      };

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              data.error ??
              "응답을 받지 못했습니다. 입력 내용을 확인한 뒤 다시 기록해 주세요.",
          },
        ]);
      } else {
        setInput("");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply ?? "답변을 생성하지 못했습니다.",
            savedSuccess: Boolean(data.expenseSaved),
          },
        ]);

        if (data.expenseSaved && data.extracted?.date) {
          const savedVm = viewMonthFromExpenseDate(data.extracted.date);
          if (savedVm) {
            setSavedOtherMonth(savedVm);
          }
          await usageRef.current?.reload();
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "연결에 실패했습니다. 입력 내용을 유지했으니 다시 기록해 주세요.",
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-col bg-brand-page-bg">
      <header
        className="shrink-0 border-b border-brand-border bg-brand-surface px-4 py-3 pr-14 sm:px-5 sm:pr-16"
      >
        <div className="mx-auto flex max-w-6xl min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-brand-green"
              aria-hidden
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight text-brand-ink sm:text-[1.375rem]">
                UNITHE 법카노트
              </h1>
              <p className="mt-0.5 text-sm leading-snug text-brand-muted sm:text-[0.9375rem]">
                한 줄로 기록하는 유니더수학 법인카드 사용내역
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      {monthMovedNotice && (
        <p
          className="border-b border-brand-border bg-brand-surface px-4 py-2 text-center text-sm text-brand-ink"
          role="status"
        >
          {formatMonthLabel(monthMovedNotice)} 내역으로 이동했습니다.
        </p>
      )}

      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <aside
          className="w-full shrink-0 border-b border-brand-border lg:w-[min(440px,42%)] lg:overflow-y-auto lg:border-b-0 lg:border-r"
          aria-label="월별 사용내역"
        >
          <ExpenseUsageSection
            savedOtherMonth={savedOtherMonth}
            onSavedOtherMonthChange={setSavedOtherMonth}
            onMonthMovedNotice={setMonthMovedNotice}
            onReady={handleUsageReady}
          />
        </aside>

        <section
          className="flex min-h-[min(52vh,520px)] min-w-0 flex-1 flex-col bg-brand-surface lg:min-h-0"
          aria-label="기록 대화"
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 lg:py-4"
            role="log"
            aria-live="polite"
          >
            <div className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-2.5 pb-4">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] min-w-0 whitespace-pre-wrap rounded-[12px] px-3.5 py-2.5 text-base leading-relaxed ${
                        isUser
                          ? "rounded-br-[4px] bg-brand-user-bubble text-brand-ink"
                          : "rounded-bl-[4px] bg-brand-bot-bubble text-brand-ink"
                      }`}
                    >
                      {msg.savedSuccess && (
                        <p
                          className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-brand-green"
                        >
                          <span
                            aria-hidden
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-green text-[10px] text-white"
                          >
                            ✓
                          </span>
                          저장되었습니다
                        </p>
                      )}
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div
                    className="rounded-[12px] rounded-bl-[4px] bg-brand-bot-bubble px-4 py-2.5 text-sm text-brand-muted"
                  >
                    기록 중…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} className="h-2 shrink-0" />
            </div>
          </div>

          <form
            onSubmit={handleSend}
            className="shrink-0 border-t border-brand-border bg-brand-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
          >
            <div className="mx-auto flex w-full max-w-xl min-w-0 items-end gap-2">
              <label className="sr-only" htmlFor="chat-input">사용내역 입력</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="언제, 어디에, 얼마를 사용했나요?"
                disabled={sending}
                className="max-h-28 min-h-12 min-w-0 flex-1 resize-none rounded-[12px] border border-brand-border bg-brand-surface px-4 py-3 text-base text-brand-ink outline-none placeholder:text-brand-muted focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:opacity-70"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="h-12 shrink-0 rounded-[12px] bg-brand-green px-4 text-base font-medium text-white hover:bg-brand-green-hover disabled:cursor-not-allowed disabled:bg-[#a8c4b4] sm:px-5"
              >
                {sending ? "기록 중…" : "기록하기"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
