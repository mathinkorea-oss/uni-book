"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: "new-password" | "current-password";
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
};

export function PasswordField({
  label,
  name,
  autoComplete,
  value,
  onChange,
  required = true,
  minLength,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 text-sm text-brand-muted">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-12 w-full rounded-[12px] border border-brand-border bg-brand-surface py-0 pr-14 pl-3 text-base text-brand-ink outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex min-h-12 min-w-12 items-center justify-center px-2 text-sm font-medium text-brand-green"
          aria-pressed={visible}
          aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
        >
          {visible ? "숨김" : "표시"}
        </button>
      </div>
    </div>
  );
}