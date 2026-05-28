import { createElement } from "react";
import { Settings } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const settings: FeatureModule = {
  id:        "settings",
  title:     "nav.settings",
  icon:      createElement(Settings),
  route:     "/settings",
  showInNav: true,
  group:     "system",
  tone:      "neutral",
};
