import { createElement } from "react";
import { Layers } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const hub: FeatureModule = {
  id:        "hub",
  title:     "nav.hub",
  icon:      createElement(Layers),
  route:     "/hub",
  showInNav: true,
  group:     "primary",
  tone:      "neutral",
};
