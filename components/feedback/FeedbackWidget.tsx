"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Bug, Lightbulb, Star, Send, Loader2, CheckCircle2 } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";

type FeedbackType = "bug" | "feature" | "rating";

export function FeedbackWidget() {
  const [open,    setOpen]    = useState(false);
  const [type,    setType]    = useState<FeedbackType>("bug");
  const [title,   setTitle]   = useState("");
  const [body,    setBody]    = useState("");
  const [rating,  setRating]  = useState(0);
  const [hover,   setHover]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  function resetForm() {
    setTitle(""); setBody(""); setRating(0); setHover(0); setDone(false);
  }

  async function submit() {
    if (loading || done) return;
    setLoading(true);
    const token   = getAuthToken();
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    if (type === "rating") {
      if (rating === 0) { setLoading(false); return; }
      await fetch("/api/feedback", {
        method: "POST", headers,
        body: JSON.stringify({ type: "rating", rating, comment: body }),
      }).catch(() => {});
    } else {
      if (!title.trim()) { setLoading(false); return; }
      await fetch("/api/feedback", {
        method: "POST", headers,
        body: JSON.stringify({ type, title: title.trim(), body: body.trim() }),
      }).catch(() => {});
    }

    setLoading(false);
    setDone(true);
    setTimeout(() => { setOpen(false); resetForm(); }, 2200);
  }

  const canSubmit =
    !loading &&
    (type === "rating" ? rating > 0 : title.trim().length > 0);

  return (
    <>
      {/* Floating trigger — above bottom nav on mobile, bottom-right on desktop */}
      <button
        onClick={() => { setOpen(o => !o); resetForm(); }}
        aria-label="إرسال ملاحظة"
        className="fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] end-4 z-40 lg:bottom-6 w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 flex items-center justify-center hover:scale-105 transition-transform"
      >
        <MessageSquare className="w-5 h-5 text-white" />
      </button>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
            style={{ backgroundColor: "rgba(11,15,20,0.72)", backdropFilter: "blur(6px)" }}
            onClick={e => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              className="w-full sm:max-w-sm card rounded-t-[1.75rem] sm:rounded-[1.5rem] p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-black t1">ملاحظاتك تهمنا 💙</p>
                <button onClick={() => setOpen(false)} className="p-1.5 t3 hover:t1 transition-colors text-base">✕</button>
              </div>

              {done ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-bold t1">شكراً! وصلنا ملاحظتك</p>
                  <p className="text-xs t3 mt-1">نسعى لتحسين تجربتك باستمرار</p>
                </div>
              ) : (
                <>
                  {/* Type tabs */}
                  <div className="flex gap-1.5">
                    {([
                      { value: "bug",     label: "خطأ",    icon: Bug       },
                      { value: "feature", label: "اقتراح", icon: Lightbulb },
                      { value: "rating",  label: "تقييم",  icon: Star      },
                    ] as const).map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button key={opt.value} onClick={() => setType(opt.value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                            type === opt.value
                              ? "bg-cyan-400/10 border border-cyan-400/30 text-cyan-400"
                              : "border border-[hsl(var(--border))] t3 hover:t2"
                          }`}>
                          <Icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Fields */}
                  {type === "rating" ? (
                    <div className="space-y-3">
                      <p className="text-xs t3 text-center">كيف تقيّم تجربتك مع Spendix؟</p>
                      <div className="flex justify-center gap-3">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            onClick={() => setRating(n)}
                            onMouseEnter={() => setHover(n)}
                            onMouseLeave={() => setHover(0)}
                            className={`text-2xl transition-all hover:scale-125 ${
                              n <= (hover || rating) ? "opacity-100" : "opacity-25"
                            }`}
                          >
                            ⭐
                          </button>
                        ))}
                      </div>
                      <textarea value={body} onChange={e => setBody(e.target.value)}
                        placeholder="تعليق اختياري..." rows={2}
                        className="input-field w-full text-sm resize-none" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={title} onChange={e => setTitle(e.target.value)}
                        placeholder={type === "bug" ? "ماذا حدث؟" : "ما الذي تقترحه؟"}
                        className="input-field w-full text-sm"
                        maxLength={200}
                      />
                      <textarea value={body} onChange={e => setBody(e.target.value)}
                        placeholder="تفاصيل إضافية (اختياري)..." rows={2}
                        className="input-field w-full text-sm resize-none"
                        maxLength={1000}
                      />
                    </div>
                  )}

                  <button
                    onClick={submit}
                    disabled={!canSubmit}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
                  >
                    {loading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                    إرسال
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
