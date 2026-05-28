// Tone variants — text / bg / border combos used across all features
export const tone = {
  // Financial direction
  income:     { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  expense:    { text: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/20"    },
  investment: { text: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/20"  },
  debt:       { text: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/20"  },
  repayment:  { text: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20"   },
  work:       { text: "text-cyan-400",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20"    },
  // Semantic status
  success: { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  warning: { text: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/20"   },
  danger:  { text: "text-rose-300",    bg: "bg-rose-400/10",    border: "border-rose-400/20"    },
  info:    { text: "text-cyan-300",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20"    },
  neutral: { text: "text-[hsl(var(--text-2))]", bg: "bg-[hsl(var(--bg-input))]", border: "border-[hsl(var(--border))]" },
} as const;

export type Tone = keyof typeof tone;

// Relationship/debt health states
export const health = {
  healthy:          tone.success,
  attention_needed: tone.warning,
  high_risk:        tone.danger,
  overdue:          tone.danger,
  settled:          tone.neutral,
} as const;

export type HealthState = keyof typeof health;

// Typography presets
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

// Badge — combines tone text + bg + px/py
export function badgeClass(t: Tone): string {
  const v = tone[t];
  return `inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${v.text} ${v.bg}`;
}

// Status dot
export function dotClass(t: Tone): string {
  return `h-1.5 w-1.5 rounded-full ${tone[t].bg.replace("/10", "")}`;
}

// Amount color helper (positive/negative)
export function amountClass(value: number): string {
  return value >= 0 ? tone.income.text : tone.expense.text;
}
