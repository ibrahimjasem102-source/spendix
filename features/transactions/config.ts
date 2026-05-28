import { createElement } from "react";
import { ArrowLeftRight } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const transactions: FeatureModule = {
  id:        "transactions",
  title:     "nav.transactions",
  icon:      createElement(ArrowLeftRight),
  route:     "/transactions",
  showInNav: true,
  group:     "primary",
  tone:      "expense",
};
