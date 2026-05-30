import { createElement } from "react";
import { Receipt } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const bills: FeatureModule = {
  id:        "bills",
  title:     "nav.bills",
  icon:      createElement(Receipt),
  route:     "/bills",
  showInNav: true,
  group:     "finance",
  tone:      "neutral",
};
