"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Bug, Lightbulb, HeadphonesIcon, CheckCircle2, Loader2 } from "lucide-react";
import { analytics } from "@/lib/analytics/events";

const TICKET_TYPES = [
  { id: "feedback", label: "تغذية راجعة", icon: MessageSquare, color: "text-blue-400 bg-blue-400/10" },
  { id: "bug",      label: "مشكلة تقنية", icon: Bug,           color: "text-red-400 bg-red-400/10" },
  { id: "feature",  label: "اقتراح ميزة", icon: Lightbulb,     color: "text-amber-400 bg-amber-400/10" },
  { id: "support",  label: "دعم فني",     icon: HeadphonesIcon, color: "text-purple-400 bg-purple-400/10" },
] as const;

interface Props {
  onClose: () => void;
}

export function SupportModal({ onClose }: Props) {
  const [type,    setType]    = useState<typeof TICKET_TYPES[number]["id"]>("feedback");
  const [title,   setTitle]   = useState("");
  const [body,    setBody]    = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  async function submit() {
    if (!title.trim() || !body.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/support", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, title, body }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        analytics.supportSubmitted(type);
        setTimeout(onClose, 2000);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6"
      style={{ backgroundColor: "rgba(11,15,20,0.80)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[1.5rem] p-10 flex flex-col items-center gap-3 card text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <p className="text-lg font-black t1">شكراً!</p>
            <p className="text-sm t3">تم إرسال رسالتك وسنرد عليك قريباً.</p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 38 }}
            className="w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[1.5rem] overflow-hidden card"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
              <p className="text-sm font-bold t1">تواصل معنا</p>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--bg-input))] transition-colors">
                <X className="w-4 h-4 t2" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Type selector */}
              <div className="grid grid-cols-2 gap-2">
                {TICKET_TYPES.map(({ id, label, icon: Icon, color }) => (
                  <button
                    key={id}
                    onClick={() => setType(id)}
                    className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold border transition-all ${
                      type === id
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-400"
                        : "border-[hsl(var(--border))] t2 hover:bg-[hsl(var(--bg-input))]"
                    }`}
                  >
                    <span className={`p-1 rounded-lg ${color}`}>
                      <Icon className="w-3 h-3" />
                    </span>
                    {label}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold t3 uppercase tracking-wider">العنوان</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="وصف مختصر..."
                  maxLength={200}
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Body */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold t3 uppercase tracking-wider">التفاصيل</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="اشرح لنا بالتفصيل..."
                  maxLength={5000}
                  rows={4}
                  className="input-field w-full text-sm resize-none"
                />
              </div>

              {/* Submit */}
              <button
                onClick={submit}
                disabled={!title.trim() || !body.trim() || loading}
                className="w-full rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                إرسال
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
