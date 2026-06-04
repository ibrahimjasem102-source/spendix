"use client";

/**
 * Global mutation error notifier.
 * Components can subscribe to this to show toasts on mutation failures.
 */
type ErrorListener = (message: string) => void;
const listeners = new Set<ErrorListener>();

export function onMutationError(fn: ErrorListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function notifyMutationError(err: unknown) {
  if (typeof window === "undefined") return;
  const message =
    err instanceof Error
      ? err.message === "errors.unauthorized"
        ? "انتهت الجلسة — سيتم تحويلك لتسجيل الدخول"
        : err.message.startsWith("HTTP 4")
          ? "فشل الحفظ. تحقق من الاتصال."
          : err.message
      : "حدث خطأ. حاول مجدداً.";
  listeners.forEach((fn) => fn(message));
}
