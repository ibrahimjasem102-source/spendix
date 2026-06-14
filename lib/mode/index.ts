export type AppMode = "personal" | "business" | "freelancer" | "family";

export interface ModeConfig {
  id:          AppMode;
  label:       string;
  emoji:       string;
  description: string;
  color:       string;
  // Feature routes that get visual emphasis in this mode
  primaryRoutes: string[];
}

export const MODES: ModeConfig[] = [
  {
    id:          "personal",
    label:       "شخصي",
    emoji:       "👤",
    description: "إدارة الميزانية والأهداف الشخصية",
    color:       "text-cyan-400",
    primaryRoutes: ["/dashboard", "/transactions", "/budgets", "/goals", "/accounts"],
  },
  {
    id:          "business",
    label:       "أعمال",
    emoji:       "🏢",
    description: "الفواتير والمشاريع والإيرادات",
    color:       "text-blue-400",
    primaryRoutes: ["/invoices", "/projects", "/contacts", "/analytics", "/export"],
  },
  {
    id:          "freelancer",
    label:       "فريلانسر",
    emoji:       "💻",
    description: "ساعات العمل، الفواتير، العملاء",
    color:       "text-purple-400",
    primaryRoutes: ["/work", "/invoices", "/projects", "/contacts", "/transactions"],
  },
  {
    id:          "family",
    label:       "عائلي",
    emoji:       "🏠",
    description: "الميزانية والأهداف العائلية المشتركة",
    color:       "text-emerald-400",
    primaryRoutes: ["/household", "/budgets", "/goals", "/subscriptions", "/calendar"],
  },
];

export const MODE_MAP = Object.fromEntries(
  MODES.map(m => [m.id, m])
) as Record<AppMode, ModeConfig>;

export function getModeConfig(mode: AppMode): ModeConfig {
  return MODE_MAP[mode] ?? MODE_MAP.personal;
}

export function isRoutePrimary(mode: AppMode, route: string): boolean {
  return getModeConfig(mode).primaryRoutes.some(r => route === r || route.startsWith(r + "/"));
}
