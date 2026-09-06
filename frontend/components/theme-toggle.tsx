"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 bg-zinc-200/70 dark:bg-zinc-800/60 rounded-full border border-zinc-300/50 dark:border-zinc-700/50 h-9 w-28">
        <div className="w-8 h-7 rounded-full bg-zinc-300/60 dark:bg-zinc-700/40 animate-pulse" />
      </div>
    );
  }

  const themes = [
    { key: "light", label: "Light", icon: Sun },
    { key: "system", label: "System", icon: Monitor },
    { key: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <div
      role="radiogroup"
      aria-label="Color theme selection"
      className="relative flex items-center p-1 bg-zinc-200/70 dark:bg-zinc-900/80 rounded-full border border-zinc-300/70 dark:border-zinc-800 backdrop-blur-md shadow-inner"
    >
      {themes.map(({ key, label, icon: Icon }) => {
        const isActive = theme === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`Switch to ${label} theme`}
            onClick={() => setTheme(key)}
            className={`relative z-10 flex items-center justify-center w-8 h-7 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer ${
              isActive
                ? "text-zinc-900 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="theme-active-pill"
                className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-700/80 -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <Icon className="w-3.5 h-3.5 transition-transform duration-200" />
          </button>
        );
      })}
    </div>
  );
}
