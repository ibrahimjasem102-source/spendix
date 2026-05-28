import { Category } from "@/types";

export const GUEST_CATEGORIES: Category[] = [
  { id: "guest-food",          user_id: "guest", name: "طعام",         type: "expense", color: "#EF4444", icon: "UtensilsCrossed", created_at: "" },
  { id: "guest-transport",     user_id: "guest", name: "مواصلات",      type: "expense", color: "#3B82F6", icon: "Car",             created_at: "" },
  { id: "guest-shopping",      user_id: "guest", name: "تسوق",         type: "expense", color: "#A855F7", icon: "ShoppingBag",     created_at: "" },
  { id: "guest-bills",         user_id: "guest", name: "فواتير",       type: "expense", color: "#F97316", icon: "Receipt",         created_at: "" },
  { id: "guest-health",        user_id: "guest", name: "صحة",          type: "expense", color: "#EC4899", icon: "Heart",           created_at: "" },
  { id: "guest-education",     user_id: "guest", name: "تعليم",        type: "expense", color: "#8B5CF6", icon: "GraduationCap",   created_at: "" },
  { id: "guest-subscriptions", user_id: "guest", name: "اشتراكات",     type: "expense", color: "#6366F1", icon: "Repeat",          created_at: "" },
  { id: "guest-other-exp",     user_id: "guest", name: "أخرى - مصروف", type: "expense", color: "#6B7280", icon: "MoreHorizontal",  created_at: "" },
  { id: "guest-salary",        user_id: "guest", name: "راتب",         type: "income",  color: "#22C55E", icon: "Banknote",        created_at: "" },
  { id: "guest-freelance",     user_id: "guest", name: "عمل حر",       type: "income",  color: "#10B981", icon: "Laptop",          created_at: "" },
  { id: "guest-gift",          user_id: "guest", name: "هدية",         type: "income",  color: "#F59E0B", icon: "Gift",            created_at: "" },
  { id: "guest-other-inc",     user_id: "guest", name: "أخرى - دخل",   type: "income",  color: "#6B7280", icon: "MoreHorizontal",  created_at: "" },
];
