"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  getRoomForPath,
  ROOM_DEFINITIONS,
  useRoomLocks,
  type LockedRoomId,
} from "@/contexts/RoomLockContext";
import { useTranslation } from "@/lib/i18n";
import { tapTransition } from "@/lib/motion";

function getRoomLabelKey(room: LockedRoomId | null) {
  return ROOM_DEFINITIONS.find((item) => item.id === room)?.labelKey ?? "rooms.locked_room";
}

export default function RoomGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { ready, unlockRoom, isRoomLocked, isRoomUnlocked } = useRoomLocks();
  const room = useMemo(() => getRoomForPath(pathname), [pathname]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const locked = isRoomLocked(room) && !isRoomUnlocked(room);

  if (!ready || !locked || !room) return <>{children}</>;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room) return;
    if (unlockRoom(room, pin)) {
      setPin("");
      setError("");
      return;
    }
    setError(t("rooms.pin_error"));
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] items-center justify-center px-1 py-8">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="card w-full max-w-sm p-5 sm:p-6"
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-black t1">{t("rooms.locked_title")}</p>
            <p className="mt-1 text-xs leading-relaxed t3">
              {t("rooms.locked_body", { room: t(getRoomLabelKey(room)) })}
            </p>
          </div>
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide t3">
          {t("rooms.pin_label")}
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-3))]" />
          <input
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              if (error) setError("");
            }}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            className="field ps-10"
            placeholder={t("rooms.pin_placeholder")}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <motion.button
          type="submit"
          disabled={pin.trim().length < 4}
          whileTap={{ scale: 0.96 }}
          transition={tapTransition}
          className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-[#071018] transition-all disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {t("rooms.unlock")}
        </motion.button>
      </motion.form>
    </div>
  );
}
