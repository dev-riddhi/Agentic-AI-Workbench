"use client";

import React, { createContext, useContext, useState, useEffect, useSyncExternalStore } from 'react';
import { User } from '@/lib/api/types';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  demoLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const emptySubscribe = () => () => {};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user_profile');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const storedToken = localStorage.getItem('access_token');

    if (storedToken) {
      authApi.getCurrentUser()
        .then((currentUser) => {
          if (active) {
            setUser(currentUser);
            localStorage.setItem('user_profile', JSON.stringify(currentUser));
          }
        })
        .catch(() => {
          // Token is invalid/expired
          if (active) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user_profile');
            setUser(null);
            setToken(null);
          }
        });
    }

    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const tokenData = await authApi.login(email, password);
      localStorage.setItem('access_token', tokenData.access_token);
      localStorage.setItem('refresh_token', tokenData.refresh_token);
      setToken(tokenData.access_token);

      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      localStorage.setItem('user_profile', JSON.stringify(currentUser));
      router.push('/agents');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      await authApi.register(name, email, password);
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_profile');
      setUser(null);
      setToken(null);
      setIsLoading(false);
      router.push('/auth/login');
    }
  };

  const demoLogin = async () => {
    // Perform real authentication against the backend using seeded administrator credentials
    try {
      await login('admin@example.com', 'admin');
    } catch {
      // If backend network error, still try to proceed
      router.push('/agents');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: isClient ? user : null,
        token: isClient ? token : null,
        isAuthenticated: isClient && !!user,
        isLoading,
        isReady: isClient,
        login,
        register,
        logout,
        demoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
