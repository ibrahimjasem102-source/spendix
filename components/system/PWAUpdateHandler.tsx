"use client";

import { useEffect } from "react";

export default function PWAUpdateHandler() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalRuntime =
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost";
    const isCapacitorRuntime = window.location.protocol === "capacitor:";

    if (isLocalRuntime || isCapacitorRuntime) {
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
          if (navigator.serviceWorker.controller && sessionStorage.getItem(reloadKey) !== "1") {
            sessionStorage.setItem(reloadKey, "1");
            window.location.reload();
          }
        })
        .catch(() => {
          // Cache cleanup is best-effort; the app should still render normally.
        });
      return;
    }

    let refreshing = false;
    const reloadOnControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadOnControllerChange);
    navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => {
      // The app can still run if the browser refuses a service worker update.
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControllerChange);
    };
  }, []);

  return null;
}
