import { createElement } from "react";
import { Tag } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const tags: FeatureModule = {
  id:        "tags",
  title:     "nav.tags",
  icon:      createElement(Tag, { size: 18 }),
  route:     "/tags",
  showInNav: false,
  group:     "finance",
  tone:      "info",
};
