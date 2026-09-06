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
      "bg-emerald-950/50 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]",
    scheduled:
      "bg-amber-950/50 text-amber-300 border-amber-500/40 shadow-[0_0_12px_-2px_rgba(245,158,11,0.25)]",
    offline:
      "bg-zinc-900/80 text-zinc-400 border-zinc-700/60",
    danger:
      "bg-rose-950/50 text-rose-300 border-rose-500/40 shadow-[0_0_12px_-2px_rgba(244,63,94,0.3)]",
    cyan:
      "bg-cyan-950/50 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_-2px_rgba(6,182,212,0.3)]",
    violet:
      "bg-indigo-950/50 text-indigo-300 border-indigo-500/40 shadow-[0_0_12px_-2px_rgba(99,102,241,0.25)]",
    model:
      "bg-zinc-900 text-zinc-300 border-zinc-700 font-mono tracking-tight tabular-nums",
    outline:
      "bg-transparent text-zinc-400 border-zinc-700/60 hover:border-zinc-500",
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
