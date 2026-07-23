"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  fullWidth?: boolean;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-[0_12px_30px_rgba(99,102,241,0.28)] hover:shadow-[0_18px_38px_rgba(99,102,241,0.38)]",
  secondary:
    "border border-white/60 bg-white/75 text-slate-800 shadow-lg backdrop-blur-xl hover:bg-white",
  danger:
    "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-[0_12px_30px_rgba(244,63,94,0.25)]",
  ghost:
    "bg-white/10 text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/20",
};

export default function AuroraButton({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  disabled,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold",
        "transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.06]",
        "active:translate-y-0 active:scale-[0.97]",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300/60",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100",
        fullWidth ? "w-full" : "",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
