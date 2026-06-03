import { createElement } from "react";
import { RefreshCw } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const recurringTransactions: FeatureModule = {
  id:        "recurring",
  title:     "nav.recurring",
  icon:      createElement(RefreshCw),
  route:     "/recurring",
  showInNav: false,
  group:     "finance",
  tone:      "neutral",
};
