"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function PWAUpdatePrompt() {
  const { t }           = useTranslation();
  const [show, setShow] = useState(false);
  const [worker, setWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;

        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            // New service worker installed — prompt user
            setWorker(installing);
            setShow(true);
          }
        });
      });
    }).catch(() => {});

    // Listen for controller change (after skip-waiting)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  function update() {
    if (worker) {
      worker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1  }}
          exit={{    y: 80, opacity: 0  }}
          className="fixed bottom-20 inset-x-4 z-[100] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-96"
        >
          <div className="card p-4 shadow-2xl border border-cyan-400/20 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-400/10 shrink-0">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold t1">{t("pwa.update_title")}</p>
              <p className="text-xs t3 mt-0.5">{t("pwa.update_body")}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={update}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {t("pwa.update_now")}
              </button>
              <button
                onClick={() => setShow(false)}
                className="p-1 rounded t3 hover:t2 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
