import React, { createContext, useCallback, useContext, useState } from 'react';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = (opts: ToastOptions) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, ...opts }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`rounded-lg border p-4 shadow-lg cursor-pointer bg-white transition-all ${
              t.variant === 'destructive'
                ? 'border-red-200 bg-red-50'
                : 'border-slate-200'
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                t.variant === 'destructive' ? 'text-red-700' : 'text-slate-800'
              }`}
            >
              {t.title}
            </p>
            {t.description && (
              <p className="text-xs text-slate-500 mt-1">{t.description}</p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
