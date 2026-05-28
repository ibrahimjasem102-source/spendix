import { createElement } from "react";
import { Briefcase } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const work: FeatureModule = {
  id:        "work",
  title:     "nav.work",
  icon:      createElement(Briefcase),
  route:     "/work",
  showInNav: true,
  group:     "finance",
  tone:      "work",
};
