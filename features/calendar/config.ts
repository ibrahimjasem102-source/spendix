import { createElement } from "react";
import { CalendarDays } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const calendar: FeatureModule = {
  id:        "calendar",
  title:     "nav.calendar",
  icon:      createElement(CalendarDays),
  route:     "/calendar",
  showInNav: true,
  group:     "finance",
  tone:      "neutral",
};
