import type { ReactNode } from "react";

type LoginShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function LoginShell({ title, description, children, footer }: LoginShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand-page-bg px-4 py-8">
      <div className="w-full max-w-sm rounded-[16px] border border-brand-border bg-brand-surface px-5 py-6 shadow-sm">
        <div className="mb-6 flex items-start gap-2.5">
          <span
            className="mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-brand-green"
            aria-hidden
          />
          <div>
            <h1 className="text-xl font-bold text-brand-ink">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-brand-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}