import { createElement } from "react";
import { Bot } from "lucide-react";
import type { FeatureModule } from "@/features/registry";

export const aiAssistant: FeatureModule = {
  id:        "ai-assistant",
  title:     "nav.ai_assistant",
  icon:      createElement(Bot),
  route:     "/ai-assistant",
  showInNav: true,
  group:     "ai",
  tone:      "investment",
};
