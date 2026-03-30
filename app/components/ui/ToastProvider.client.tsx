"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/app/lib/cn";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function variantClasses(variant: ToastVariant) {
  if (variant === "success") return "border-emerald-500/30 bg-emerald-500/12";
  if (variant === "error") return "border-red-500/35 bg-red-500/12";
  return "border-border bg-card/95";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    window.setTimeout(() => removeToast(id), 3800);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(420px,calc(100%-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-xl border p-3 shadow-lg backdrop-blur-md transition-opacity",
              variantClasses(toast.variant),
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold">{toast.title}</div>
                {toast.description ? <div className="text-xs text-foreground/70">{toast.description}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-md px-2 py-1 text-xs text-foreground/60 hover:bg-muted"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
