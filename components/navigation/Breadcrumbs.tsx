"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { getNavItem } from "@/lib/routes";
import { useTranslation } from "@/lib/i18n";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const { t }    = useTranslation();
  const item     = getNavItem(pathname);

  // Don't render on dashboard (it is the home)
  if (!item || pathname === "/dashboard") return null;

  return (
    <nav
      className="hidden sm:flex items-center gap-1.5 text-xs mb-4 px-0.5"
      aria-label="Breadcrumb"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 t3 hover:t2 transition-colors"
      >
        <Home className="w-3 h-3" />
        <span>{t("dashboard.title")}</span>
      </Link>
      <ChevronRight className="w-3 h-3 t3" />
      <span className="t2 font-medium">{t(item.title)}</span>
    </nav>
  );
}
