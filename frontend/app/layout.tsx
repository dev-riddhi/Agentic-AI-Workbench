import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AuthProvider } from "@/context/auth-context";
import { ToastProvider } from "@/context/toast-context";
import { NotificationProvider } from "@/context/notification-context";
import { NavigationShell } from "@/components/layout/navigation-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sovereign On-Premise Agentic AI Workbench",
  description:
    "Enterprise-grade air-gapped agent orchestration with local GGUF models, pgvector RAG pipelines, and deterministic tool runtimes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <Providers>
          <AuthProvider>
            <ToastProvider>
              <NotificationProvider>
                <NavigationShell>{children}</NavigationShell>
              </NotificationProvider>
            </ToastProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
