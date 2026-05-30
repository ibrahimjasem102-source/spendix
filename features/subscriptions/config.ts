import { createElement } from "react";
import { RefreshCw } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const subscriptions: FeatureModule = {
  id:        "subscriptions",
  title:     "nav.subscriptions",
  icon:      createElement(RefreshCw),
  route:     "/subscriptions",
  showInNav: true,
  group:     "finance",
  tone:      "neutral",
};
