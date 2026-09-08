"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useToast, ToastType } from "./toast-context";

export interface SystemNotificationItem {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  timestamp: string;
  read?: boolean;
  metadata?: Record<string, unknown>;
}

interface NotificationContextType {
  notifications: SystemNotificationItem[];
  unreadCount: number;
  isConnected: boolean;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  clearNotifications: () => Promise<void>;
  sendNotification: (
    message: string,
    title?: string,
    type?: ToastType
  ) => Promise<SystemNotificationItem | null>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = "workbench_system_notifications";
const MAX_STORED_NOTIFICATIONS = 50;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<SystemNotificationItem[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Load cached notifications on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SystemNotificationItem[];
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
          parsed.forEach((n) => {
            if (n.id) processedIdsRef.current.add(n.id);
          });
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  // Save notifications to localStorage when updated
  const saveNotifications = useCallback((items: SystemNotificationItem[]) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items.slice(0, MAX_STORED_NOTIFICATIONS))
      );
    } catch {
      // Storage limits or private mode
    }
  }, []);

  const addNotification = useCallback(
    (item: SystemNotificationItem, triggerToast: boolean = true) => {
      // Deduplicate by notification id
      if (processedIdsRef.current.has(item.id)) {
        return;
      }
      processedIdsRef.current.add(item.id);

      setNotifications((prev) => {
        const next = [item, ...prev.filter((n) => n.id !== item.id)].slice(
          0,
          MAX_STORED_NOTIFICATIONS
        );
        saveNotifications(next);
        return next;
      });

      if (triggerToast) {
        const toastType: ToastType =
          item.type === "success" ||
          item.type === "error" ||
          item.type === "warning" ||
          item.type === "info"
            ? item.type
            : "info";
        showToast(item.message, toastType, item.title);
      }
    },
    [showToast, saveNotifications]
  );

  // Subscribe to real-time notification SSE stream
  useEffect(() => {
    let isCancelled = false;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let abortController: AbortController | null = null;

    const connectStream = async () => {
      if (isCancelled) return;
      abortController = new AbortController();

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

      try {
        const res = await fetch(`${API_BASE_URL}/notifications/stream`, {
          signal: abortController.signal,
          headers: {
            Accept: "text/event-stream",
          },
        });

        if (!res.ok || !res.body) {
          throw new Error(`SSE stream failed with status ${res.status}`);
        }

        setIsConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (!isCancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed.startsWith("data:")) {
              const payloadStr = trimmed.slice(5).trim();
              if (payloadStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(payloadStr);
                if (parsed.type === "connected") {
                  setIsConnected(true);
                  continue;
                }

                if (parsed.id && parsed.message) {
                  addNotification(
                    {
                      id: parsed.id,
                      title: parsed.title || "Agent Notification",
                      message: parsed.message,
                      type: parsed.type || "info",
                      timestamp: parsed.timestamp || new Date().toISOString(),
                      read: false,
                      metadata: parsed.metadata,
                    },
                    true
                  );
                }
              } catch {
                // Ignore parse errors on transient chunks
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setIsConnected(false);
          // Reconnect with backoff
          reconnectTimeout = setTimeout(connectStream, 4000);
        }
      }
    };

    connectStream();

    // Also fetch recent notifications once on mount
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    fetch(`${API_BASE_URL}/notifications?limit=30`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && !isCancelled) {
          data.forEach((item: SystemNotificationItem) => {
            addNotification(item, false);
          });
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      if (abortController) abortController.abort();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [addNotification]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(next);
      return next;
    });

    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
      method: "POST",
    }).catch(() => {});
  }, [saveNotifications]);

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        saveNotifications(next);
        return next;
      });

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: "PATCH",
      }).catch(() => {});
    },
    [saveNotifications]
  );

  const clearNotifications = useCallback(async () => {
    setNotifications([]);
    processedIdsRef.current.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      await fetch(`${API_BASE_URL}/notifications`, { method: "DELETE" });
    } catch {
      // Ignore
    }
  }, []);

  const sendNotification = useCallback(
    async (
      message: string,
      title: string = "Agent Notification",
      type: ToastType = "info"
    ): Promise<SystemNotificationItem | null> => {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      try {
        const res = await fetch(`${API_BASE_URL}/notifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, title, type }),
        });
        if (res.ok) {
          const data = await res.json();
          addNotification(data, true);
          return data;
        }
      } catch (err) {
        console.error("Failed to post notification:", err);
      }
      return null;
    },
    [addNotification]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isConnected,
      markAllAsRead,
      markAsRead,
      clearNotifications,
      sendNotification,
    }),
    [
      notifications,
      unreadCount,
      isConnected,
      markAllAsRead,
      markAsRead,
      clearNotifications,
      sendNotification,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
