import { createElement } from "react";
import { Landmark } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const debts: FeatureModule = {
  id:        "debts",
  title:     "nav.debts",
  icon:      createElement(Landmark),
  route:     "/debts",
  showInNav: true,
  group:     "finance",
  tone:      "debt",
};
