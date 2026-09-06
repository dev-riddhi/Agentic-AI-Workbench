"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import LoginPage from "@/app/auth/login/page";

const KNOWN_PROTECTED_PREFIXES = [
  "/agents",
  "/documents",
  "/models",
  "/chat",
  "/runtime",
  "/operations",
  "/settings",
];

export function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isReady } = useAuth();
  const [isTokenRefreshing, setIsTokenRefreshing] = useState(false);

  // Listen for transparent refresh token rotation events
  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsTokenRefreshing(Boolean(customEvent.detail));
    };

    window.addEventListener("auth:token-refreshing", handleRefresh);
    return () => {
      window.removeEventListener("auth:token-refreshing", handleRefresh);
    };
  }, []);

  const isAuthPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/");

  const isProtected = KNOWN_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // Initial SSR mount & token resolution
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Top Token Refreshing Feedback Bar
  const tokenRefreshBar = isTokenRefreshing ? (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse" />
  ) : null;

  // If on login/auth page
  if (isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {tokenRefreshBar}
        {children}
      </div>
    );
  }

  // If unauthenticated trying to access protected workspace
  if (!isAuthenticated && isProtected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {tokenRefreshBar}
        <LoginPage />
      </div>
    );
  }

  // If unmapped route (e.g. 404 page)
  if (!isProtected) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#050508] dark:text-zinc-100">
        {tokenRefreshBar}
        {children}
      </div>
    );
  }

  const isChatPage = pathname === "/chat";

  // Authenticated user on protected workspace
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {tokenRefreshBar}
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 ${isChatPage ? "overflow-hidden" : "overflow-y-auto"}`}>
        <Header />
        <main
          className={
            isChatPage
              ? "flex-1 flex flex-col min-h-0 overflow-hidden"
              : "flex-1 p-6 md:p-8 bg-zinc-100/60 dark:bg-zinc-950/60 max-w-7xl w-full mx-auto"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
