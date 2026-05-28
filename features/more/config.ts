import { createElement } from "react";
import { Grid3X3 } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const more: FeatureModule = {
  id:        "more",
  title:     "nav.more",
  icon:      createElement(Grid3X3),
  route:     "/more",
  showInNav: true,
  group:     "system",
  tone:      "neutral",
};
