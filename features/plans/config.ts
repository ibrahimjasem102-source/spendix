import { CreditCard } from "lucide-react";
import { createElement } from "react";
import type { FeatureModule } from "@/features/registry";

export const plans: FeatureModule = {
  id:         "plans",
  title:      "nav.plans",
  icon:       createElement(CreditCard, { size: 18 }),
  route:      "/plans",
  showInNav:  true,
  group:      "system",
  tone:       "neutral",
};
