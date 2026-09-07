"use client";

import React, { createContext, useContext, useState, useCallback, useId, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const baseId = useId();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string) => {
      const id = `${baseId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastItem = { id, message, type, title };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [baseId, removeToast]
  );

  const toast = useMemo(() => ({
    success: (message: string, title?: string) => showToast(message, 'success', title),
    error: (message: string, title?: string) => showToast(message, 'error', title),
    warning: (message: string, title?: string) => showToast(message, 'warning', title),
    info: (message: string, title?: string) => showToast(message, 'info', title),
  }), [showToast]);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        options,
        resolve: (val: boolean) => {
          setConfirmDialog(null);
          resolve(val);
        },
      });
    });
  }, []);

  const contextValue = useMemo(
    () => ({ showToast, toast, confirm }),
    [showToast, toast, confirm]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* TOAST CONTAINER (Top Right) */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-4 flex items-start gap-3 text-xs ${
                isSuccess
                  ? 'bg-zinc-900/95 border-emerald-500/40 text-zinc-100 shadow-emerald-500/5'
                  : isError
                  ? 'bg-zinc-900/95 border-rose-500/40 text-zinc-100 shadow-rose-500/5'
                  : isWarning
                  ? 'bg-zinc-900/95 border-amber-500/40 text-zinc-100 shadow-amber-500/5'
                  : 'bg-zinc-900/95 border-cyan-500/40 text-zinc-100 shadow-cyan-500/5'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {t.type === 'info' && <Info className="w-4 h-4 text-cyan-400" />}
              </div>

              <div className="flex-1 min-w-0">
                {t.title && (
                  <div className="font-bold text-zinc-100 text-xs mb-0.5">
                    {t.title}
                  </div>
                )}
                <div className="text-zinc-300 leading-relaxed font-sans">
                  {t.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-zinc-500 hover:text-zinc-300 p-1 -mr-1 -mt-1 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* CONFIRMATION / PROMPT MODAL */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  confirmDialog.options.danger !== false
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                }`}
              >
                {confirmDialog.options.danger !== false ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-bold text-zinc-100">
                  {confirmDialog.options.title || 'Confirm Action'}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {confirmDialog.options.message}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-2.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => confirmDialog.resolve(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                {confirmDialog.options.cancelText || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => confirmDialog.resolve(true)}
                className={`px-4 py-2 rounded-xl text-white font-semibold transition-all cursor-pointer shadow-md ${
                  confirmDialog.options.danger !== false
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
                }`}
              >
                {confirmDialog.options.confirmText || 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
