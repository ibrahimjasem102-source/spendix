"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Trash2, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import SheetDragHandle from "@/components/ui/SheetDragHandle";

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const spring = { type: "spring" as const, stiffness: 380, damping: 32 };

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      style={{
        backgroundColor: "rgba(11,15,20,0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <motion.div
        initial={{ y: 56, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={spring}
        className="w-full rounded-t-[2rem] sm:max-w-sm sm:rounded-[1.75rem]"
        style={{
          backgroundColor: "hsl(var(--bg-card))",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {/* Drag handle â€” mobile only */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <SheetDragHandle onClose={onCancel} disabled={loading} />
        </div>

        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-6 text-center">
          {/* Icon */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "radial-gradient(ellipse at top, rgba(244,63,94,0.18) 0%, rgba(244,63,94,0.06) 100%)",
              border: "1px solid rgba(244,63,94,0.2)",
            }}
          >
            <Trash2 className="h-7 w-7 text-rose-400" />
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <h3 className="text-base font-bold t1">
              {title ?? t("common.delete_confirm_title")}
            </h3>
            <p className="text-sm t2 leading-relaxed max-w-[260px]">{message}</p>
          </div>

          {/* Actions */}
          <div className="w-full space-y-2.5">
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{
                background: loading
                  ? "#9f1239"
                  : "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
                boxShadow: loading ? "none" : "0 4px 20px rgba(244,63,94,0.35)",
              }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t("common.deleting") : confirmLabel ?? t("common.delete")}
            </button>

            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-semibold t2 hover:t1 transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{
                background: "hsl(var(--bg-input))",
                border: "1px solid hsl(var(--border))",
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>

        {/* Safe-area bottom padding on mobile */}
        <div className="sm:hidden" style={{ height: "max(0px, env(safe-area-inset-bottom, 0px))" }} />
      </motion.div>
    </div>
  );
}

