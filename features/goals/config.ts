import { createElement } from "react";
import { Goal } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const goals: FeatureModule = {
  id:        "goals",
  title:     "nav.goals",
  icon:      createElement(Goal),
  route:     "/goals",
  showInNav: true,
  group:     "finance",
  tone:      "success",
};
