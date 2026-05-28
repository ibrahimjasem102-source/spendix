"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export default function CapacitorInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function hideSplash() {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide({ fadeOutDuration: 300 });
    }

    hideSplash().catch(() => undefined);
  }, []);

  return null;
}
