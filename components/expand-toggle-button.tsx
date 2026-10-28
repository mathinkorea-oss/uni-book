"use client";

type Props = {
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
  showLabel?: string;
  hideLabel?: string;
  className?: string;
};

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExpandToggleButton({
  expanded,
  onToggle,
  controlsId,
  showLabel = "보기",
  hideLabel = "숨기기",
  className = "",
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controlsId}
      className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-[10px] px-2 text-sm text-brand-green hover:bg-brand-user-bubble ${className}`}
    >
      <span>{expanded ? hideLabel : showLabel}</span>
      <Chevron up={expanded} />
    </button>
  );
}
