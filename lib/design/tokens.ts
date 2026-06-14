// ─────────────────────────────────────────────────────────────────────────────
// Spendix Design System — Tokens
// Single source of truth for all visual decisions.
// CSS custom properties (defined in globals.css) are referenced via hsl(var(--*)).
// ─────────────────────────────────────────────────────────────────────────────

// ── Colors — semantic aliases to CSS variables ────────────────────────────────

export const colors = {
  /** Page background — darkest layer */
  bgPage:  "hsl(var(--bg-page))",
  /** Card surface — primary card/panel */
  bgCard:  "hsl(var(--bg-card))",
  /** Elevated card surface */
  bgCard2: "hsl(var(--bg-card-2))",
  /** Input/well background */
  bgInput: "hsl(var(--bg-input))",

  /** Default border */
  border:  "hsl(var(--border))",
  /** Subtle/hairline border */
  border2: "hsl(var(--border-2))",

  /** Primary text — near white */
  text1: "hsl(var(--text-1))",
  /** Secondary text — muted */
  text2: "hsl(var(--text-2))",
  /** Tertiary text — very muted */
  text3: "hsl(var(--text-3))",

  accent: {
    /** Brand primary — cyan */
    cyan:    "hsl(var(--accent-cyan))",
    /** Income / success — emerald */
    emerald: "hsl(var(--accent-emerald))",
    /** Expense / danger — rose */
    rose:    "hsl(var(--accent-rose))",
    /** Warning — amber */
    amber:   "hsl(var(--accent-amber))",
    /** Investment / premium — purple */
    purple:  "hsl(var(--accent-purple))",
  },
} as const;

// ── Spacing — 4px base grid ───────────────────────────────────────────────────

export const spacing = {
  0:    "0px",
  0.5:  "2px",
  1:    "4px",
  1.5:  "6px",
  2:    "8px",
  2.5:  "10px",
  3:    "12px",
  3.5:  "14px",
  4:    "16px",
  5:    "20px",
  6:    "24px",
  7:    "28px",
  8:    "32px",
  10:   "40px",
  12:   "48px",
  14:   "56px",
  16:   "64px",
  20:   "80px",
  24:   "96px",
} as const;

// ── Border Radius ─────────────────────────────────────────────────────────────

export const radius = {
  none: "0px",
  xs:   "6px",
  sm:   "8px",
  md:   "12px",
  lg:   "16px",   // matches --radius
  xl:   "20px",
  "2xl": "24px",
  "3xl": "28px",
  full: "9999px",
} as const;

// ── Shadows — elevation levels ────────────────────────────────────────────────

export const shadows = {
  none: "none",
  /** Subtle lift — cards at rest */
  sm:   "0 1px 3px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.12)",
  /** Hover lift */
  md:   "0 4px 12px rgba(0,0,0,0.24), 0 2px 6px rgba(0,0,0,0.12)",
  /** Dropdowns, popovers */
  lg:   "0 8px 24px rgba(0,0,0,0.30), 0 4px 8px rgba(0,0,0,0.14)",
  /** Modals, sheets */
  xl:   "0 20px 48px rgba(0,0,0,0.48), 0 8px 16px rgba(0,0,0,0.18)",
  /** Full modal overlay */
  "2xl": "0 25px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.35)",
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

export const typography = {
  size: {
    "2xs": "10px",
    xs:    "12px",
    sm:    "13px",
    base:  "14px",
    md:    "15px",
    lg:    "16px",
    xl:    "18px",
    "2xl": "20px",
    "3xl": "24px",
    "4xl": "30px",
    "5xl": "36px",
  },
  weight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
    black:    800,
  },
  leading: {
    none:     "1",
    tight:    "1.25",
    snug:     "1.375",
    normal:   "1.5",
    relaxed:  "1.625",
    loose:    "2",
  },
  tracking: {
    tighter: "-0.04em",
    tight:   "-0.02em",
    normal:  "0em",
    wide:    "0.04em",
    wider:   "0.08em",
    widest:  "0.14em",
  },
  /** Font families */
  family: {
    sans:  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    mono:  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    num:   "Inter, ui-sans-serif, system-ui",  // + tabular-nums feature
  },
} as const;

// ── Z-index scale ─────────────────────────────────────────────────────────────

export const z = {
  base:     0,
  card:     1,
  sticky:   10,
  nav:      20,
  dropdown: 30,
  overlay:  50,
  modal:    60,
  toast:    70,
  tooltip:  80,
  top:      100,
} as const;

// ── Animation ─────────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    instant: 80,
    fast:    110,
    normal:  180,
    slow:    300,
    lazy:    500,
  },
  /** Spring presets for framer-motion */
  spring: {
    /** Button taps, icon presses */
    snap: { type: "spring" as const, stiffness: 500, damping: 36, mass: 0.6 },
    /** Modal/sheet entry */
    sheet: { type: "spring" as const, stiffness: 380, damping: 38, mass: 0.9 },
    /** List items, cards */
    gentle: { type: "spring" as const, stiffness: 260, damping: 26, mass: 0.8 },
  },
  easing: {
    out:   [0.0, 0.0, 0.2, 1.0]  as const,
    inOut: [0.4, 0.0, 0.2, 1.0]  as const,
    back:  [0.34, 1.56, 0.64, 1] as const,
  },
} as const;

// ── Breakpoints ───────────────────────────────────────────────────────────────

export const breakpoints = {
  sm:  640,
  md:  768,
  lg:  1024,
  xl:  1280,
  "2xl": 1536,
} as const;

// ── Touch targets ─────────────────────────────────────────────────────────────
// WCAG 2.5.5 recommends 44×44px minimum touch target

export const touch = {
  min:  "44px",
  icon: "38px",
  nav:  "48px",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY — kept for backward compatibility with existing pages
// (tone, health, text, card, badgeClass, dotClass, amountClass)
// ─────────────────────────────────────────────────────────────────────────────

// Tone variants — text / bg / border combos used across all features
export const tone = {
  income:     { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  expense:    { text: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/20"    },
  investment: { text: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/20"  },
  debt:       { text: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/20"  },
  repayment:  { text: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20"   },
  work:       { text: "text-cyan-400",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20"    },
  success:    { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  warning:    { text: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/20"   },
  danger:     { text: "text-rose-300",    bg: "bg-rose-400/10",    border: "border-rose-400/20"    },
  info:       { text: "text-cyan-300",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20"    },
  neutral:    { text: "text-[hsl(var(--text-2))]", bg: "bg-[hsl(var(--bg-input))]", border: "border-[hsl(var(--border))]" },
} as const;

export type Tone = keyof typeof tone;

export const health = {
  healthy:          tone.success,
  attention_needed: tone.warning,
  high_risk:        tone.danger,
  overdue:          tone.danger,
  settled:          tone.neutral,
} as const;

export type HealthState = keyof typeof health;

// Typography presets (class-based)
export const text = {
  label:   "text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--text-3))]",
  caption: "text-xs text-[hsl(var(--text-2))]",
  body:    "text-sm text-[hsl(var(--text-1))]",
  title:   "text-base font-semibold text-[hsl(var(--text-1))]",
  heading: "text-lg font-bold text-[hsl(var(--text-1))]",
  amount:  "font-bold number-display tabular-nums",
} as const;

export type TextVariant = keyof typeof text;

// Card surface presets
export const card = {
  base:     "modern-card",
  metric:   "metric-tile",
  command:  "command-pill",
  elevated: "rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card-2))]",
  glass:    "rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl",
} as const;

export type CardVariant = keyof typeof card;

export function badgeClass(t: Tone): string {
  const v = tone[t];
  return `inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${v.text} ${v.bg}`;
}

export function dotClass(t: Tone): string {
  return `h-1.5 w-1.5 rounded-full ${tone[t].bg.replace("/10", "")}`;
}

export function amountClass(value: number): string {
  return value >= 0 ? tone.income.text : tone.expense.text;
}
