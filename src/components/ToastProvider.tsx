"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "error" | "success" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone) => {
      const id = nextId++;
      setItems((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 5600);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      showError: (message) => push(message, "error"),
      showSuccess: (message) => push(message, "success"),
      showInfo: (message) => push(message, "info"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100%-2rem,24rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded border px-3 py-2 text-sm shadow-md ${
              t.tone === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : t.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-zinc-200 bg-white text-zinc-800"
            }`}
            role={t.tone === "error" ? "alert" : "status"}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-snug">{t.message}</p>
              <button
                type="button"
                className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showError: (message) => {
        console.error(message);
        if (typeof window !== "undefined") window.alert(message);
      },
      showSuccess: (message) => console.info(message),
      showInfo: (message) => console.info(message),
    };
  }
  return ctx;
}
