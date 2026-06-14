"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, CheckCircle2, Users, Loader2 } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";
import { analytics } from "@/lib/analytics/events";

interface ReferralData {
  code: string;
  inviteUrl: string;
  totalReferrals: number;
  completedReferrals: number;
}

export function ReferralCard() {
  const [data, setData]     = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]  = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setLoading(false); return; }

    fetch("/api/referral/invite", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCopy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.inviteUrl);
      setCopied(true);
      analytics.referralSent();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement("textarea");
      el.value = data.inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="card p-5 flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-400/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-bold t1">دعوة الأصدقاء</p>
          <p className="text-xs t3">ادعُ صديقاً واحصل على شهر Plus مجاناً</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[hsl(var(--bg-input))] p-3 text-center">
          <Users className="w-4 h-4 t3 mx-auto mb-1" />
          <p className="text-lg font-black t1">{data?.totalReferrals ?? 0}</p>
          <p className="text-[10px] t3">دعوات مُرسَلة</p>
        </div>
        <div className="rounded-xl bg-[hsl(var(--bg-input))] p-3 text-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg font-black t1">{data?.completedReferrals ?? 0}</p>
          <p className="text-[10px] t3">مكتملة</p>
        </div>
      </div>

      {/* Invite link */}
      {data && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold t3 uppercase tracking-wider">رابط الدعوة</p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] px-3 py-2.5 text-xs t2 font-mono truncate">
              {data.inviteUrl}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 px-3 py-2 text-xs font-bold text-cyan-400 hover:bg-cyan-400/20 transition-colors shrink-0"
            >
              {copied
                ? <><CheckCircle2 className="w-3.5 h-3.5" />تم</>
                : <><Copy className="w-3.5 h-3.5" />نسخ</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Reward explanation */}
      <div className="rounded-xl bg-purple-400/5 border border-purple-400/20 p-3">
        <p className="text-xs t2 leading-relaxed">
          عندما يسجّل صديقك باستخدام رابطك ويفعّل حسابه، تحصل أنت تلقائياً على{" "}
          <span className="font-bold text-purple-400">شهر Plus مجاناً</span>.
        </p>
      </div>
    </div>
  );
}
