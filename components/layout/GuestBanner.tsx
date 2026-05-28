"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { useGuest } from "@/contexts/GuestContext";
import { useTranslation } from "@/lib/i18n";

export default function GuestBanner() {
  const { isGuest, isLoading } = useGuest();
  const { t } = useTranslation();
  if (isLoading || !isGuest) return null;

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-400/15">
      <div className="flex items-center gap-2 text-sm text-amber-300/80 min-w-0">
        <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <span className="truncate">{t("guest_banner.message")}</span>
      </div>
      <Link
        href="/signup"
        className="shrink-0 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg transition-colors"
      >
        {t("guest_banner.cta")}
      </Link>
    </div>
  );
}
