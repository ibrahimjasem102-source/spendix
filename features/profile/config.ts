import { createElement } from "react";
import { User } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const profile: FeatureModule = {
  id:        "profile",
  title:     "nav.profile",
  icon:      createElement(User),
  route:     "/profile",
  showInNav: false,
  group:     "system",
  tone:      "neutral",
};
