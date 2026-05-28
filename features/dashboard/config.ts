import { createElement } from "react";
import { LayoutDashboard } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const dashboard: FeatureModule = {
  id:        "dashboard",
  title:     "nav.dashboard",
  icon:      createElement(LayoutDashboard),
  route:     "/dashboard",
  showInNav: true,
  group:     "primary",
  tone:      "neutral",
};
