import { createElement } from "react";
import { Download } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const exportData: FeatureModule = {
  id:        "export",
  title:     "nav.export",
  icon:      createElement(Download),
  route:     "/export",
  showInNav: false,
  group:     "system",
  tone:      "neutral",
};
