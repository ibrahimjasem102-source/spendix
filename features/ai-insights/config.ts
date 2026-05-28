import { createElement } from "react";
import { Sparkles } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const aiInsights: FeatureModule = {
  id:        "ai-insights",
  title:     "nav.ai_insights",
  icon:      createElement(Sparkles),
  route:     "/ai-insights",
  showInNav: true,
  group:     "ai",
  tone:      "investment",
};
