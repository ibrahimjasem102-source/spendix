import { createElement } from "react";
import { FileText } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const invoices: FeatureModule = {
  id:        "invoices",
  title:     "nav.invoices",
  icon:      createElement(FileText),
  route:     "/invoices",
  showInNav: false,
  group:     "finance",
  tone:      "income",
};
