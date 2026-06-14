import { createElement } from "react";
import { Shield } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const adminPanel: FeatureModule = {
  id:        "admin",
  title:     "nav.admin",
  icon:      createElement(Shield),
  route:     "/admin",
  showInNav: false,
  group:     "system",
  tone:      "danger",
};
