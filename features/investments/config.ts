import { createElement } from "react";
import { TrendingUp } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const investments: FeatureModule = {
  id:        "investments",
  title:     "nav.investments",
  icon:      createElement(TrendingUp),
  route:     "/investments",
  showInNav: true,
  group:     "finance",
  tone:      "investment",
};
