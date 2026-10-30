"use client";

import { useRef, type FormEvent, type KeyboardEvent } from "react";

function ClipboardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  input: string;
  sending: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e?: FormEvent) => void;
  onOpenCardSms: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function ExpenseRecordInput({
  input,
  sending,
  onInputChange,
  onSubmit,
  onOpenCardSms,
  inputRef,
}: Props) {
  const composingRef = useRef(false);
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (composingRef.current || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void onSubmit();
  }

  return (
    <div className="mb-4 rounded-[12px] border border-brand-border bg-brand-surface px-3 py-3">
      <button
        type="button"
        onClick={onOpenCardSms}
        className="mb-2 flex h-12 w-full min-h-12 items-center justify-center gap-2 rounded-[12px] bg-brand-green text-base font-medium text-white transition-colors hover:bg-brand-green-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/30 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ClipboardIcon />
        카드 문자 붙여넣기
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(e);
        }}
        className="flex min-w-0 items-center gap-2"
      >
        <input
          id="expense-record-input"
          ref={ref}
          type="text"
          enterKeyHint="send"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onFocus={() => {
            window.setTimeout(() => {
              ref.current?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              });
            }, 280);
          }}
          disabled={sending}
          placeholder="언제, 어디서, 얼마?"
          aria-label="사용내역 직접 입력"
          autoComplete="off"
          className="box-border h-12 min-h-12 max-h-12 min-w-0 flex-1 overflow-x-auto rounded-[12px] border border-brand-border bg-brand-surface px-3 text-base leading-normal text-brand-ink outline-none placeholder:text-[#5c6560] focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:opacity-70"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="box-border inline-flex h-12 min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] bg-brand-green px-4 text-base font-medium text-white hover:bg-brand-green-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/30 active:opacity-90 disabled:cursor-not-allowed disabled:bg-[#a8c4b4]"
        >
          {sending ? "기록 중…" : "기록하기"}
        </button>
      </form>
    </div>
  );
}
