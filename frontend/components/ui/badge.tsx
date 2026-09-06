import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "active" | "scheduled" | "offline" | "danger" | "cyan" | "violet" | "model" | "outline";
  size?: "sm" | "md";
  pulse?: boolean;
}

export function Badge({
  children,
  className = "",
  variant = "offline",
  size = "md",
  pulse = false,
  ...props
}: BadgeProps) {
  const baseClasses =
    "inline-flex items-center font-medium border transition-colors select-none";

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 rounded-md gap-1.5",
    md: "text-xs px-2.5 py-1 rounded-lg gap-1.5",
  }[size];

  const variantClasses = {
    active:
      "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/40 shadow-[0_0_12px_-2px_rgba(16,185,129,0.2)]",
    scheduled:
      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/40 shadow-[0_0_12px_-2px_rgba(245,158,11,0.2)]",
    offline:
      "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-900/80 dark:text-zinc-400 dark:border-zinc-700/60",
    danger:
      "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-500/40 shadow-[0_0_12px_-2px_rgba(244,63,94,0.2)]",
    cyan:
      "bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-500/40 shadow-[0_0_12px_-2px_rgba(6,182,212,0.2)]",
    violet:
      "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-500/40 shadow-[0_0_12px_-2px_rgba(99,102,241,0.2)]",
    model:
      "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 font-mono tracking-tight tabular-nums",
    outline:
      "bg-transparent text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700/60 hover:border-zinc-400 dark:hover:border-zinc-500",
  }[variant];

  return (
    <span className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`} {...props}>
      {variant === "active" && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {pulse && variant !== "active" && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
