"use client";

import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { ToastItem } from "@/hooks/useToast";

const CONFIG = {
  success: { icon: CheckCircle, cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" },
  error:   { icon: XCircle,     cls: "border-rose-400/30 bg-rose-400/10 text-rose-400"         },
  info:    { icon: Info,        cls: "border-cyan-400/30 bg-cyan-400/10 text-cyan-400"          },
};

interface Props {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

export default function ToastList({ toasts, dismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((toast) => {
        const { icon: Icon, cls } = CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl shadow-black/30 text-sm font-medium backdrop-blur-xl pointer-events-auto ${cls}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="t1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="ms-1 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
