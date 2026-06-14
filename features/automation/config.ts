import { createElement } from "react";
import { Zap } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const automation: FeatureModule = {
  id:        "automation",
  title:     "nav.automation",
  icon:      createElement(Zap),
  route:     "/automation",
  showInNav: false,
  group:     "system",
  tone:      "warning",
};
