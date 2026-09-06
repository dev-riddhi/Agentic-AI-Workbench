"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "pill" | "outline" | "emerald";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseClasses =
      "relative inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97]";

    // Variant styles
    const variantClasses = {
      primary:
        "bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] hover:shadow-[0_0_24px_-2px_rgba(6,182,212,0.6)] focus-visible:ring-cyan-500 border border-cyan-400/40",
      secondary:
        "bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700/60 hover:border-zinc-400 dark:hover:border-zinc-600 backdrop-blur-md focus-visible:ring-zinc-400 shadow-sm",
      danger:
        "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800/60 hover:border-rose-400 dark:hover:border-rose-700 focus-visible:ring-rose-500 shadow-[0_0_16px_-4px_rgba(244,63,94,0.3)]",
      ghost:
        "bg-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 focus-visible:ring-zinc-400 border border-transparent",
      pill:
        "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-950/70 dark:hover:bg-zinc-900 dark:text-zinc-200 rounded-full border border-violet-500/40 hover:border-cyan-400/60 shadow-[0_0_18px_-2px_rgba(139,92,246,0.3)] hover:shadow-[0_0_22px_-2px_rgba(6,182,212,0.45)] focus-visible:ring-cyan-400 backdrop-blur-md",
      outline:
        "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 focus-visible:ring-zinc-400",
      emerald:
        "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-[0_0_20px_-3px_rgba(16,185,129,0.4)] hover:shadow-[0_0_24px_-2px_rgba(16,185,129,0.6)] focus-visible:ring-emerald-500 border border-emerald-400/40",
    }[variant];

    // Size styles
    const sizeClasses = {
      xs: "text-xs px-2.5 py-1 rounded-md gap-1.5",
      sm: "text-xs px-3 py-1.5 rounded-lg gap-2",
      md: "text-sm px-4 py-2 rounded-lg gap-2",
      lg: "text-base px-6 py-2.5 rounded-xl gap-2.5",
      icon: "p-2 rounded-lg aspect-square justify-center",
    }[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
