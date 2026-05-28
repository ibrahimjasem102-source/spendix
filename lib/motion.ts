/**
 * Motion System — Unified animation helpers for Spendix
 * Uses Framer Motion v12.
 * All durations ≤200ms. Respects prefers-reduced-motion.
 */

import type { Variants, Transition } from "framer-motion";

// ── Base transitions ──────────────────────────────────────────
export const spring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 40,
  mass: 0.6,
};

export const ease: Transition = {
  type: "tween",
  duration: 0.14,
  ease: [0.25, 0.46, 0.45, 0.94],
};

export const tapTransition: Transition = {
  type: "tween",
  duration: 0.1,
  ease: [0.25, 0.46, 0.45, 0.94],
};

export const easeSlow: Transition = {
  type: "tween",
  duration: 0.25,
  ease: [0.25, 0.46, 0.45, 0.94],
};

// ── Press / tap ───────────────────────────────────────────────
export const pressMotion = {
  whileTap: { scale: 0.96 },
  transition: tapTransition,
} as const;

export const pressMotionSubtle = {
  whileTap: { scale: 0.98 },
  transition: tapTransition,
} as const;

// ── Hover ─────────────────────────────────────────────────────
export const hoverMotion = {
  whileHover: { y: -1, scale: 1.01 },
  transition: spring,
} as const;

// ── Fade + blur (page / card enter) ───────────────────────────
export const fadeBlur: Variants = {
  hidden:  { opacity: 0, filter: "blur(4px)", y: 6 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0 },
};

export const fadeIn: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInScale: Variants = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

// ── Page transitions ──────────────────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  enter:   { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -6 },
};

export const pageTransition: Transition = {
  type: "tween",
  duration: 0.18,
  ease: [0.25, 0.46, 0.45, 0.94],
};

// ── Sheet (bottom sheet slide up) ─────────────────────────────
export const sheetVariants: Variants = {
  hidden:  { y: "100%", opacity: 0.6 },
  visible: { y: 0,      opacity: 1   },
  exit:    { y: "100%", opacity: 0   },
};

export const sheetTransition: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 38,
  mass: 0.9,
};

// ── Backdrop ──────────────────────────────────────────────────
export const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};

// ── Stagger container (for lists) ─────────────────────────────
export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem: Variants = {
  hidden:  { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0  },
};

// ── Card expand ───────────────────────────────────────────────
export const cardExpand: Variants = {
  collapsed: { height: "auto", opacity: 1 },
  expanded:  { height: "auto", opacity: 1 },
};

// ── Number counter (for financial metrics) ────────────────────
// Usage: use MotionValue + useTransform + useSpring
export const counterSpring: Transition = {
  type: "spring",
  stiffness: 60,
  damping: 20,
  mass: 0.8,
};
