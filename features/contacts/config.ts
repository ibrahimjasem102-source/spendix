import { createElement } from "react";
import { Users } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const contacts: FeatureModule = {
  id:        "contacts",
  title:     "nav.contacts",
  icon:      createElement(Users),
  route:     "/contacts",
  showInNav: true,
  group:     "finance",
  tone:      "info",
};
