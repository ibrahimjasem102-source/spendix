"use client";

import { Shield, Lock, Database, Eye, Trash2, Download, Server, User } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";

interface DataItem {
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  bg: string;
}

export default function PrivacyPage() {
  const { t } = useTranslation();

  const dataItems: DataItem[] = [
    {
      icon: User,
      title: t("privacy.item_account"),
      desc:  t("privacy.item_account_desc"),
      color: "text-cyan-400",
      bg:    "bg-cyan-400/10",
    },
    {
      icon: Database,
      title: t("privacy.item_financial"),
      desc:  t("privacy.item_financial_desc"),
      color: "text-emerald-400",
      bg:    "bg-emerald-400/10",
    },
    {
      icon: Server,
      title: t("privacy.item_storage"),
      desc:  t("privacy.item_storage_desc"),
      color: "text-purple-400",
      bg:    "bg-purple-400/10",
    },
    {
      icon: Eye,
      title: t("privacy.item_ai"),
      desc:  t("privacy.item_ai_desc"),
      color: "text-amber-400",
      bg:    "bg-amber-400/10",
    },
  ];

  const protections = [
    t("privacy.protection_rls"),
    t("privacy.protection_https"),
    t("privacy.protection_auth"),
    t("privacy.protection_no_third_party"),
    t("privacy.protection_no_ads"),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10">
          <Shield className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black t1">{t("privacy.title")}</h1>
          <p className="mt-0.5 text-xs font-medium t3">{t("privacy.subtitle")}</p>
        </div>
      </div>

      {/* What we store */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide t3 px-1">{t("privacy.section_stored")}</p>
        <div className="space-y-2">
          {dataItems.map((item) => (
            <div key={item.title} className="card p-4 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold t1">{item.title}</p>
                <p className="text-xs t3 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Protections */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          <p className="text-sm font-bold t1">{t("privacy.section_protections")}</p>
        </div>
        {protections.map((p, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs t2 leading-relaxed">{p}</p>
          </div>
        ))}
      </section>

      {/* Your rights */}
      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide t3 px-1">{t("privacy.section_rights")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/export"
            className="card p-4 flex flex-col items-center gap-2 text-center hover:border-cyan-400/30 transition-colors">
            <Download className="w-5 h-5 text-cyan-400" />
            <p className="text-xs font-semibold t1">{t("privacy.right_export")}</p>
            <p className="text-[10px] t3">{t("privacy.right_export_desc")}</p>
          </Link>
          <Link href="/settings"
            className="card p-4 flex flex-col items-center gap-2 text-center hover:border-rose-400/30 transition-colors">
            <Trash2 className="w-5 h-5 text-rose-400" />
            <p className="text-xs font-semibold t1">{t("privacy.right_delete")}</p>
            <p className="text-[10px] t3">{t("privacy.right_delete_desc")}</p>
          </Link>
        </div>
      </section>

      {/* Data retention */}
      <section className="card p-4">
        <p className="text-sm font-bold t1 mb-2">{t("privacy.retention_title")}</p>
        <p className="text-xs t3 leading-relaxed">{t("privacy.retention_body")}</p>
      </section>
    </div>
  );
}
