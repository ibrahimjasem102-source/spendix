"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { migrateGuestData } from "@/lib/guest/migrate";
import { useTranslation } from "@/lib/i18n";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default function AuthFinalizePage() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    async function finalize() {
      const params = new URLSearchParams(window.location.search);
      await fetch("/api/auth/bootstrap", { method: "POST" }).catch(() => undefined);
      await migrateGuestData().catch(() => undefined);
      router.replace(safeNext(params.get("next")));
      router.refresh();
    }

    void finalize();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "hsl(214 28% 5%)" }}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}>
          <Wallet className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
        <p className="text-sm font-semibold text-white">{t("auth.finishing_login")}</p>
      </div>
    </div>
  );
}
