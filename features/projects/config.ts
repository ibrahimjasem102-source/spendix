import { createElement } from "react";
import { FolderOpen } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const projects: FeatureModule = {
  id:        "projects",
  title:     "nav.projects",
  icon:      createElement(FolderOpen),
  route:     "/projects",
  showInNav: false,
  group:     "finance",
  tone:      "work",
};
