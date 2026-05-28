"use client";

import { useEffect, useState } from "react";
import { MailWarning, X, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGuest } from "@/contexts/GuestContext";
import { useTranslation } from "@/lib/i18n";

export default function EmailVerificationBanner() {
  const { isGuest, isLoading } = useGuest();
  const { t } = useTranslation();

  const [unverified, setUnverified] = useState(false);
  const [email, setEmail]           = useState("");
  const [dismissed, setDismissed]   = useState(false);
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);

  useEffect(() => {
    if (isLoading || isGuest) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      // email_confirmed_at is null when email not yet confirmed
      if (!user.email_confirmed_at) {
        setUnverified(true);
        setEmail(user.email ?? "");
      }
    });
  }, [isGuest, isLoading]);

  async function resend() {
    if (!email || sending) return;
    setSending(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email });
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 5000);
  }

  if (isLoading || isGuest || !unverified || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 shrink-0"
      style={{
        background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.06))",
        borderBottom: "1px solid rgba(239,68,68,0.15)",
      }}>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <MailWarning className="w-4 h-4 shrink-0 text-rose-400" />
        <p className="text-xs sm:text-sm text-rose-300/90 truncate">
          {sent
            ? t("auth.verification_sent")
            : t("auth.email_not_verified")}
          {!sent && email && (
            <span className="text-rose-400/60 hidden sm:inline"> — {email}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!sent && (
          <button
            onClick={resend}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 bg-rose-400/10 hover:bg-rose-400/20 border border-rose-400/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${sending ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("auth.resend_verification")}</span>
            <span className="sm:hidden">{t("auth.resend")}</span>
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
