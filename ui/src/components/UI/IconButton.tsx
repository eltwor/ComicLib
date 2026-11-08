import type { ReactNode } from "react";

type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
};

export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface transition-colors hover:border-muted hover:bg-raised disabled:opacity-40 ${
        danger
          ? "text-muted hover:border-rose-400 hover:text-rose-400"
          : "text-body"
      }`}
    >
      {children}
    </button>
  );
}
