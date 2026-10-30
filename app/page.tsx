"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExpenseUsageSection,
  type UsageSectionHandle,
} from "@/components/expense-usage-section";
import { CardSmsSheet } from "@/components/card-sms-sheet";
import { ExpenseRecordInput } from "@/components/expense-record-input";
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
  "카드 문자를 붙여넣거나 사용내역을 직접 입력하세요.";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savedOtherMonth, setSavedOtherMonth] = useState<ViewMonth | null>(null);
  const [monthMovedNotice, setMonthMovedNotice] = useState<ViewMonth | null>(
    null,
  );
  const [cardSmsOpen, setCardSmsOpen] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const usageRef = useRef<UsageSectionHandle | null>(null);
  const prevMessageCount = useRef(0);

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
    const el = chatScrollRef.current;
    if (!el) return;
    if (messages.length <= prevMessageCount.current) return;
    prevMessageCount.current = messages.length;
    el.scrollTop = el.scrollHeight;
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

  async function handleCardSmsSaved(date: string) {
    const savedVm = viewMonthFromExpenseDate(date);
    if (savedVm) {
      setSavedOtherMonth(savedVm);
    }
    await usageRef.current?.reload();
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "카드 승인 문자를 지출로 저장했습니다.",
        savedSuccess: true,
      },
    ]);
  }

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-col bg-brand-page-bg">
      <header className="shrink-0 border-b border-brand-border bg-brand-surface px-4 py-2.5">
        <div className="mx-auto flex max-w-6xl min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-[3px] bg-brand-green"
            aria-hidden
          />
          <h1 className="min-w-0 flex-1 whitespace-nowrap text-[1.125rem] font-bold leading-none tracking-tight text-brand-ink min-[360px]:text-[1.25rem] sm:text-[1.375rem]">
            UNITHE 법카노트
          </h1>
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
            recordInput={
              <ExpenseRecordInput
                input={input}
                sending={sending}
                onInputChange={setInput}
                onSubmit={handleSend}
                onOpenCardSms={() => setCardSmsOpen(true)}
                inputRef={inputRef}
              />
            }
          />
        </aside>

        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-brand-surface lg:min-h-0"
          aria-label="기록 대화"
        >
          <div
            ref={chatScrollRef}
            className="min-h-[min(40vh,360px)] flex-1 overflow-y-auto px-3 py-3 sm:px-4 lg:min-h-0 lg:py-4"
            role="log"
            aria-live="polite"
          >
            <div className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-2 pb-2">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const isWelcome = msg.id === "welcome";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] min-w-0 whitespace-pre-wrap text-base leading-relaxed ${
                        isWelcome
                          ? "rounded-[12px] rounded-bl-[4px] bg-brand-bot-bubble px-3 py-2 text-[0.9375rem] leading-snug text-brand-ink"
                          : isUser
                            ? "rounded-[12px] rounded-br-[4px] bg-brand-user-bubble px-3.5 py-2.5 text-brand-ink"
                            : "rounded-[12px] rounded-bl-[4px] bg-brand-bot-bubble px-3.5 py-2.5 text-brand-ink"
                      }`}
                    >
                      {msg.savedSuccess && (
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-brand-green">
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
                  <div className="rounded-[12px] rounded-bl-[4px] bg-brand-bot-bubble px-4 py-2.5 text-sm text-brand-muted">
                    기록 중…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} className="h-1 shrink-0" aria-hidden />
            </div>
          </div>
        </section>
      </div>

      <CardSmsSheet
        open={cardSmsOpen}
        onClose={() => setCardSmsOpen(false)}
        getSortMode={() => usageRef.current?.getSortMode() ?? "date"}
        onSaved={(expense, date) => {
          void handleCardSmsSaved(date);
        }}
      />
    </div>
  );
}
