import { createElement } from "react";
import { BookOpen } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const ledger: FeatureModule = {
  id:        "ledger",
  title:     "nav.ledger",
  icon:      createElement(BookOpen),
  route:     "/ledger",
  showInNav: false,
  group:     "system",
  tone:      "neutral",
};
