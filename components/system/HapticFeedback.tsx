"use client";

import { useEffect } from "react";

const ACTION_SELECTOR = [
  "button",
  "a",
  "[role='button']",
  ".pressable",
  ".btn-primary",
  ".btn-danger",
  ".btn-ghost",
  ".tab-pill",
].join(",");

export default function HapticFeedback() {
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

    let lastPulse = 0;
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(ACTION_SELECTOR)) return;

      const now = Date.now();
      if (now - lastPulse < 140) return;
      lastPulse = now;
      navigator.vibrate(8);
    };

    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  return null;
}
