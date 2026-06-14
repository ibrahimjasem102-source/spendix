"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useOnline } from "@/lib/offline/use-online";
import { useSyncEngine } from "@/lib/offline/sync-engine";
import { getPendingCount } from "@/lib/offline/sync-queue";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";

export function OfflineBanner() {
  const { t }                      = useTranslation();
  const { isOnline, wasOffline }   = useOnline();
  const queryClient                = useQueryClient();
  const [pendingCount, setPending] = useState(0);
  const [syncing, setSyncing]      = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  // Refresh pending count
  useEffect(() => {
    if (!isOnline) {
      const timer = setInterval(() => {
        getPendingCount().then(setPending).catch(() => {});
      }, 2000);
      getPendingCount().then(setPending).catch(() => {});
      return () => clearInterval(timer);
    }
  }, [isOnline]);

  const { sync } = useSyncEngine({
    onSyncStart:    () => setSyncing(true),
    onSyncComplete: (result) => {
      setSyncing(false);
      setPending(result.remaining);
      if (result.succeeded > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
    },
    onInvalidate: () => queryClient.invalidateQueries(),
  });

  const show = !isOnline || justSynced || (wasOffline && syncing);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{    y: -48, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed top-0 inset-x-0 z-[100] safe-top"
        >
          {justSynced ? (
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-400 bg-emerald-400/10 border-b border-emerald-400/20">
              <CheckCircle2 className="w-4 h-4" />
              {t("offline.synced")}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-400/10 border-b border-amber-400/20">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-sm font-semibold text-amber-400">
                  {t("offline.offline_mode")}
                  {pendingCount > 0 && (
                    <span className="ms-1.5 text-[10px] font-bold bg-amber-400/20 px-1.5 py-0.5 rounded-full">
                      {pendingCount} {t("offline.pending")}
                    </span>
                  )}
                </p>
              </div>
              {syncing && (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
