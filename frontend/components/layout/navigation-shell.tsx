"use client";

import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import LoginPage from '@/app/auth/login/page';

export function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isReady } = useAuth();

  const isAuthPage =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/auth/');

  // Initial SSR mount & token resolution
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If on login/auth page
  if (isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-zinc-100 bg-grid-pattern">
        {children}
      </div>
    );
  }

  // If unauthenticated and trying to access protected feature routes
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-zinc-100 bg-grid-pattern">
        <LoginPage />
      </div>
    );
  }

  const isChatPage = pathname === '/chat';

  // Authenticated user: show persistent sidebar, header, and workbench features
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 ${isChatPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <Header />
        <main
          className={
            isChatPage
              ? 'flex-1 flex flex-col min-h-0 overflow-hidden'
              : 'flex-1 p-6 md:p-8 bg-zinc-950/60 max-w-7xl w-full mx-auto'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
