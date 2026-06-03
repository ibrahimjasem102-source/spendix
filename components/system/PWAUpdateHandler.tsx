"use client";

import { useEffect } from "react";

export default function PWAUpdateHandler() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let removeControllerListener: (() => void) | undefined;

    const clearServiceWorkerCache = () => {
      const reloadKey = "spendix-sw-cleared";
      Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        ),
        "caches" in window
          ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          : Promise.resolve([]),
      ])
        .then(() => {
          if (!cancelled && navigator.serviceWorker.controller && sessionStorage.getItem(reloadKey) !== "1") {
            sessionStorage.setItem(reloadKey, "1");
            window.location.reload();
          }
        })
        .catch(() => {
          // Cache cleanup is best-effort; the app should still render normally.
        });
    };

    async function boot() {
      const isLocalRuntime =
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "localhost";
      const isCapacitorProtocol = window.location.protocol === "capacitor:";
      const isNativeRuntime = await import("@capacitor/core")
        .then(({ Capacitor }) => Capacitor.isNativePlatform())
        .catch(() => false);

      if (cancelled) return;

      if (isLocalRuntime || isCapacitorProtocol || isNativeRuntime) {
        clearServiceWorkerCache();
        return;
      }

      let refreshing = false;
      const reloadOnControllerChange = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", reloadOnControllerChange);
      removeControllerListener = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControllerChange);
      };

      navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => {
        // The app can still run if the browser refuses a service worker update.
      });
    }

    void boot();

    return () => {
      cancelled = true;
      removeControllerListener?.();
    };
  }, []);

  return null;
}
