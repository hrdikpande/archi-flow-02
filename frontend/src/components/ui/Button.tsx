import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  busy?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover border-transparent",
  secondary: "bg-surface text-text border-border hover:bg-surface-muted",
  ghost: "bg-transparent text-text border-transparent hover:bg-surface-muted",
  danger: "bg-surface text-danger border-danger hover:bg-danger-bg",
};

export function Button({
  variant = "secondary",
  size = "md",
  busy = false,
  icon,
  disabled,
  children,
  className,
  type = "button",
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "motion-hover inline-flex items-center justify-center gap-1.5 rounded-sm border font-semibold whitespace-nowrap",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-7 px-2 text-small" : "h-9 px-3 text-body",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {busy ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
