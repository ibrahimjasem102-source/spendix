"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
import { onMutationError } from "@/lib/query/mutation-toast";

export default function MutationErrorToast() {
  const [messages, setMessages] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const unsub = onMutationError((message) => {
      const id = crypto.randomUUID();
      setMessages((prev) => [...prev.slice(-2), { id, text: message }]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, 4000);
    });
    return unsub;
  }, []);

  return (
    <div className="fixed top-4 inset-x-3 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="flex items-center gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 shadow-lg pointer-events-auto backdrop-blur-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <p className="flex-1 text-sm font-medium text-rose-300">{m.text}</p>
            <button
              type="button"
              onClick={() => setMessages((prev) => prev.filter((x) => x.id !== m.id))}
              className="rounded-lg p-1 text-rose-400/60 hover:text-rose-400 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
