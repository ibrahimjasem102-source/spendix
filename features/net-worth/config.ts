import { createElement } from "react";
import { Scale } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const netWorth: FeatureModule = {
  id:        "net-worth",
  title:     "nav.net_worth",
  icon:      createElement(Scale),
  route:     "/net-worth",
  showInNav: true,
  group:     "finance",
  tone:      "info",
};
