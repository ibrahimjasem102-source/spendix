"use client";

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export async function haptic(style: HapticStyle = "light") {
  try {
    // Use vibrate API as fallback on web
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      const pattern =
        style === "light"   ? [10]       :
        style === "medium"  ? [20]       :
        style === "heavy"   ? [40]       :
        style === "success" ? [10, 50, 10] :
        style === "warning" ? [20, 30, 20] :
        style === "error"   ? [50, 30, 50] : [10];
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore if vibrate not supported
  }
}
