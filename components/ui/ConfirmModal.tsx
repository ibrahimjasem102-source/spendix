"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="modal-card w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 rounded-xl bg-rose-400/10 shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold t1 mb-1">
              {title ?? t("common.delete_confirm_title")}
            </h3>
            <p className="text-sm t2">{message}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-[hsl(var(--border))] t2 hover:t1 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? t("common.deleting") : confirmLabel ?? t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
