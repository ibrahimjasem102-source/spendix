"use client";

import {
  UtensilsCrossed, Car, ShoppingBag, Receipt, Heart, GraduationCap,
  Repeat, Gamepad2, Shirt, Home, Briefcase, Laptop, Gift, RefreshCw,
  TrendingUp, TrendingDown, Building, CreditCard, Landmark, Coins,
  BarChart3, Gem, TreePine, FileText, Clock, Users, Banknote,
  MoreHorizontal, DollarSign, Wallet, Package,
  type LucideIcon,
} from "lucide-react";

// ── Icon registry (name → component) ─────────────────────────
export const ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed, Car, ShoppingBag, Receipt, Heart, GraduationCap,
  Repeat, Gamepad2, Shirt, Home, Briefcase, Laptop, Gift, RefreshCw,
  TrendingUp, TrendingDown, Building, CreditCard, Landmark, Coins,
  BarChart3, Gem, TreePine, FileText, Clock, Users, Banknote,
  MoreHorizontal, DollarSign, Wallet, Package,
};

export function getIcon(name: string | null | undefined): LucideIcon {
  return (name ? ICON_MAP[name] : null) ?? MoreHorizontal;
}

// ── Section types ─────────────────────────────────────────────
export type CategorySection =
  | "expense" | "income" | "investment"
  | "debt" | "work" | "general";

// ── Default categories per section ───────────────────────────
export interface DefaultCategory {
  name_ar: string;
  name_en: string;
  color:   string;
  icon:    string;
  type:    "expense" | "income";
  section: CategorySection;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ── Expenses ──────────────────────────────────────────────
  { name_ar: "طعام",        name_en: "Food",          color: "#EF4444", icon: "UtensilsCrossed", type: "expense", section: "expense"    },
  { name_ar: "مواصلات",     name_en: "Transport",     color: "#3B82F6", icon: "Car",             type: "expense", section: "expense"    },
  { name_ar: "تسوق",        name_en: "Shopping",      color: "#A855F7", icon: "ShoppingBag",     type: "expense", section: "expense"    },
  { name_ar: "فواتير",      name_en: "Bills",         color: "#F97316", icon: "Receipt",         type: "expense", section: "expense"    },
  { name_ar: "صحة",         name_en: "Health",        color: "#EC4899", icon: "Heart",           type: "expense", section: "expense"    },
  { name_ar: "تعليم",       name_en: "Education",     color: "#8B5CF6", icon: "GraduationCap",  type: "expense", section: "expense"    },
  { name_ar: "اشتراكات",    name_en: "Subscriptions", color: "#6366F1", icon: "Repeat",          type: "expense", section: "expense"    },
  { name_ar: "ترفيه",       name_en: "Entertainment", color: "#14B8A6", icon: "Gamepad2",        type: "expense", section: "expense"    },
  { name_ar: "ملابس",       name_en: "Clothing",      color: "#F43F5E", icon: "Shirt",           type: "expense", section: "expense"    },
  { name_ar: "منزل",        name_en: "Home",          color: "#0EA5E9", icon: "Home",            type: "expense", section: "expense"    },
  { name_ar: "أخرى - مصروف",name_en: "Other Expense", color: "#6B7280", icon: "MoreHorizontal",  type: "expense", section: "expense"    },

  // ── Income ────────────────────────────────────────────────
  { name_ar: "راتب",        name_en: "Salary",        color: "#22C55E", icon: "Banknote",        type: "income",  section: "income"     },
  { name_ar: "عمل حر",      name_en: "Freelance",     color: "#10B981", icon: "Laptop",          type: "income",  section: "income"     },
  { name_ar: "هدية",        name_en: "Gift",          color: "#F59E0B", icon: "Gift",            type: "income",  section: "income"     },
  { name_ar: "استرداد",     name_en: "Refund",        color: "#06B6D4", icon: "RefreshCw",       type: "income",  section: "income"     },
  { name_ar: "أرباح",       name_en: "Profit",        color: "#84CC16", icon: "TrendingUp",      type: "income",  section: "income"     },
  { name_ar: "أخرى - دخل", name_en: "Other Income",  color: "#6B7280", icon: "MoreHorizontal",  type: "income",  section: "income"     },

  // ── Investments ───────────────────────────────────────────
  { name_ar: "أسهم",        name_en: "Stocks",        color: "#6366F1", icon: "BarChart3",       type: "expense", section: "investment" },
  { name_ar: "عملات رقمية", name_en: "Crypto",        color: "#F59E0B", icon: "Coins",           type: "expense", section: "investment" },
  { name_ar: "ETF",          name_en: "ETF",           color: "#8B5CF6", icon: "TrendingUp",      type: "expense", section: "investment" },
  { name_ar: "ذهب",          name_en: "Gold",          color: "#EAB308", icon: "Gem",             type: "expense", section: "investment" },
  { name_ar: "عقار",         name_en: "Real Estate",   color: "#10B981", icon: "Building",        type: "expense", section: "investment" },
  { name_ar: "سندات",        name_en: "Bonds",         color: "#64748B", icon: "FileText",        type: "expense", section: "investment" },

  // ── Debts ─────────────────────────────────────────────────
  { name_ar: "دين شخصي",    name_en: "Personal Debt", color: "#EF4444", icon: "Users",           type: "expense", section: "debt"       },
  { name_ar: "بنك",          name_en: "Bank",          color: "#3B82F6", icon: "Landmark",        type: "expense", section: "debt"       },
  { name_ar: "بطاقة ائتمان",name_en: "Credit Card",   color: "#F97316", icon: "CreditCard",      type: "expense", section: "debt"       },
  { name_ar: "قرض",          name_en: "Loan",          color: "#DC2626", icon: "DollarSign",      type: "expense", section: "debt"       },
  { name_ar: "فاتورة مؤجلة",name_en: "Deferred Bill", color: "#D97706", icon: "Receipt",         type: "expense", section: "debt"       },

  // ── Work ──────────────────────────────────────────────────
  { name_ar: "دوام",         name_en: "Employment",    color: "#06B6D4", icon: "Briefcase",       type: "income",  section: "work"       },
  { name_ar: "مشروع",        name_en: "Project",       color: "#8B5CF6", icon: "Package",         type: "income",  section: "work"       },
  { name_ar: "عميل",         name_en: "Client",        color: "#10B981", icon: "Users",           type: "income",  section: "work"       },
  { name_ar: "دفعة عمل",    name_en: "Work Payment",  color: "#22C55E", icon: "Wallet",          type: "income",  section: "work"       },
  { name_ar: "ساعات عمل",   name_en: "Hours",         color: "#0EA5E9", icon: "Clock",           type: "income",  section: "work"       },
];

// ── Preset color palette ──────────────────────────────────────
export const COLOR_PALETTE = [
  "#EF4444","#F97316","#F59E0B","#EAB308","#84CC16",
  "#22C55E","#10B981","#14B8A6","#06B6D4","#0EA5E9",
  "#3B82F6","#6366F1","#8B5CF6","#A855F7","#EC4899",
  "#F43F5E","#64748B","#6B7280",
];
