import { createElement } from "react";
import { BarChart3 } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const analytics: FeatureModule = {
  id:        "analytics",
  title:     "nav.analytics",
  icon:      createElement(BarChart3),
  route:     "/analytics",
  showInNav: true,
  group:     "primary",
  tone:      "info",
};
