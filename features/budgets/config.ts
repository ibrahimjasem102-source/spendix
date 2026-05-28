import { createElement } from "react";
import { Target } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const budgets: FeatureModule = {
  id:        "budgets",
  title:     "nav.budgets",
  icon:      createElement(Target),
  route:     "/budgets",
  showInNav: true,
  group:     "finance",
  tone:      "income",
};
