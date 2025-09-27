import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastInternal extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  push: (options: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-500 bg-emerald-50 text-emerald-800",
  error: "border-red-500 bg-red-50 text-red-800",
  info: "border-primary-500 bg-primary-50 text-primary-800",
};

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const scheduleRemoval = useCallback((toast: ToastInternal) => {
    const timeout = setTimeout(() => remove(toast.id), toast.duration ?? 5000);
    timers.current[toast.id] = timeout;
  }, [remove]);

  const push = useCallback(
    ({ title, description, variant = "info", duration = 5000 }: ToastOptions) => {
      const toast: ToastInternal = {
        id: generateId(),
        title: title.trim(),
        description: description?.trim() || undefined,
        variant,
        duration,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev, toast]);
      scheduleRemoval(toast);
      return toast.id;
    },
    [scheduleRemoval],
  );

  const success = useCallback((title: string, description?: string) => push({ title, description, variant: "success" }), [push]);
  const error = useCallback((title: string, description?: string) => push({ title, description, variant: "error" }), [push]);
  const info = useCallback((title: string, description?: string) => push({ title, description, variant: "info" }), [push]);

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push, success, error, info, remove }), [push, success, error, info, remove]);

  const portalTarget = typeof document !== "undefined" ? document.body : undefined;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalTarget
        ? createPortal(
            <div className="pointer-events-none fixed top-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-3">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`pointer-events-auto overflow-hidden rounded-lg border shadow-sm transition-all ${variantStyles[toast.variant]}`}
                >
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{toast.title}</p>
                      {toast.description ? <p className="mt-1 text-xs text-current/80">{toast.description}</p> : null}
                    </div>
                    <button
                      className="text-lg font-bold leading-none text-current/70 transition hover:text-current"
                      onClick={() => remove(toast.id)}
                      aria-label="Dismiss notification"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>,
            portalTarget,
          )
        : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export default ToastProvider;
