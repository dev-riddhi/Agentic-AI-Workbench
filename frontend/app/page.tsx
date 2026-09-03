"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import LoginPage from "./auth/login/page";

export default function RootPage() {
  const { isAuthenticated, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace("/agents");
    }
  }, [isAuthenticated, isReady, router]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <LoginPage />;
}
