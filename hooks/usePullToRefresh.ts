"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  onRefresh: () => Promise<void> | void;
  threshold?: number;   // px to pull before triggering (default 80)
  scrollTarget?: string; // CSS selector for the scroll container
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: Options) {
  const [pulling,    setPulling]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progress,   setProgress]   = useState(0); // 0–1
  const startY   = useRef(0);
  const pulling_ = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only trigger when scrolled to top
    const el = document.querySelector("main");
    if (!el || el.scrollTop > 2) return;
    startY.current = e.touches[0].clientY;
    pulling_.current = true;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling_.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) { pulling_.current = false; return; }
    const p = Math.min(dy / threshold, 1);
    setProgress(p);
    setPulling(p > 0);
    if (dy > 10) e.preventDefault(); // prevent scroll
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling_.current) return;
    pulling_.current = false;
    const p = progress;
    setProgress(0);
    setPulling(false);
    if (p >= 1) {
      setRefreshing(true);
      try { await onRefresh(); } finally { setRefreshing(false); }
    }
  }, [onRefresh, progress]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove",  handleTouchMove,  { passive: false });
    document.addEventListener("touchend",   handleTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove",  handleTouchMove);
      document.removeEventListener("touchend",   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pulling, refreshing, progress };
}
