/** Design tokens as JS constants — mirrors the CSS custom properties in globals.css */

export const radius = {
  sm:  "8px",
  md:  "12px",
  lg:  "16px",
  xl:  "20px",
  "2xl": "24px",
  full: "9999px",
} as const;

export const spacing = {
  xs:  "4px",
  sm:  "8px",
  md:  "12px",
  lg:  "16px",
  xl:  "20px",
  "2xl": "24px",
  "3xl": "32px",
} as const;

export const fontSize = {
  "2xs": "10px",
  xs:    "11px",
  sm:    "13px",
  base:  "15px",
  lg:    "17px",
  xl:    "20px",
  "2xl": "24px",
  "3xl": "30px",
} as const;

export const fontWeight = {
  normal:    400,
  medium:    500,
  semibold:  600,
  bold:      700,
  extrabold: 800,
  black:     900,
} as const;

/** Maps to CSS hsl(var(--...)) variables — use these in style={{}} when Tailwind can't help */
export const cssVar = {
  bg1:       "hsl(var(--bg-1))",
  bg2:       "hsl(var(--bg-2))",
  bg3:       "hsl(var(--bg-3))",
  bgInput:   "hsl(var(--bg-input))",
  text1:     "hsl(var(--text-1))",
  text2:     "hsl(var(--text-2))",
  text3:     "hsl(var(--text-3))",
  border:    "hsl(var(--border))",
  border2:   "hsl(var(--border-2))",
  accentCyan: "hsl(var(--accent-cyan))",
} as const;

/** Entity color palette — consistent across badges, icons, charts */
export const entityColors = {
  income: {
    text: "text-emerald-400",
    bg:   "bg-emerald-400/10",
    hex:  "#34d399",
  },
  expense: {
    text: "text-red-400",
    bg:   "bg-red-400/10",
    hex:  "#f87171",
  },
  investment: {
    text: "text-blue-400",
    bg:   "bg-blue-400/10",
    hex:  "#60a5fa",
  },
  debt: {
    text: "text-amber-400",
    bg:   "bg-amber-400/10",
    hex:  "#fbbf24",
  },
  goal: {
    text: "text-violet-400",
    bg:   "bg-violet-400/10",
    hex:  "#a78bfa",
  },
  subscription: {
    text: "text-violet-400",
    bg:   "bg-violet-400/10",
    hex:  "#a78bfa",
  },
  work: {
    text: "text-teal-400",
    bg:   "bg-teal-400/10",
    hex:  "#2dd4bf",
  },
  contact: {
    text: "text-sky-400",
    bg:   "bg-sky-400/10",
    hex:  "#38bdf8",
  },
} as const;

export type EntityType = keyof typeof entityColors;
