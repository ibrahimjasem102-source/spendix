import { createElement } from "react";
import { Home } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const household: FeatureModule = {
  id:        "household",
  title:     "nav.household",
  icon:      createElement(Home),
  route:     "/household",
  showInNav: false,
  group:     "finance",
  tone:      "info",
};
