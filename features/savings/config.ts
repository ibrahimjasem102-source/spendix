import { createElement } from "react";
import { PiggyBank } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const savings: FeatureModule = {
  id:        "savings",
  title:     "nav.savings",
  icon:      createElement(PiggyBank),
  route:     "/savings",
  showInNav: true,
  group:     "finance",
  tone:      "success",
};
