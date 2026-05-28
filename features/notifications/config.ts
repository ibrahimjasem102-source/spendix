import { createElement } from "react";
import { Bell } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const notifications: FeatureModule = {
  id:        "notifications",
  title:     "nav.notifications",
  icon:      createElement(Bell),
  route:     "/notifications",
  showInNav: true,
  group:     "system",
  tone:      "neutral",
};
