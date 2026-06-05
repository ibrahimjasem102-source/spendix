"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { LogIn, Zap } from "lucide-react";
import { useGuest } from "@/contexts/GuestContext";
import { useTranslation } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import InlineLoginModal from "@/components/auth/InlineLoginModal";

export default function GuestBanner() {
  const { isGuest, isLoading } = useGuest();
  const { t }      = useTranslation();
  const pathname   = usePathname();
  const [showLogin, setShowLogin] = useState(false);

  if (isLoading || !isGuest || pathname === ROUTES.dashboard) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-400/15">
        <div className="flex items-center gap-2 text-sm text-amber-300/80 min-w-0">
          <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span className="truncate text-xs">{t("guest_banner.message")}</span>
        </div>
        <button
          onClick={() => setShowLogin(true)}
          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg transition-colors"
        >
          <LogIn className="w-3 h-3" />
          {t("guest_banner.cta")}
        </button>
      </div>

      <AnimatePresence>
        {showLogin && (
          <InlineLoginModal
            onClose={() => setShowLogin(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
