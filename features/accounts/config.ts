import { createElement } from "react";
import { Wallet } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const accounts: FeatureModule = {
  id:        "accounts",
  title:     "nav.accounts",
  icon:      createElement(Wallet),
  route:     "/accounts",
  showInNav: true,
  group:     "finance",
  tone:      "neutral",
};
