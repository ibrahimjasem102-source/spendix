"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AssetType, RiskLevel, Investment } from "@/lib/mock-data";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

interface Props {
  onAdd: (investment: Investment) => void;
  onClose: () => void;
}

const ASSET_TYPES: AssetType[] = ["stock", "crypto", "etf", "real_estate"];
const RISK_LEVELS: RiskLevel[]  = ["low", "medium", "high"];

const today = new Date().toISOString().split("T")[0];

export default function AddInvestmentModal({ onAdd, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const [form, setForm] = useState({
    name: "", type: "stock" as AssetType, quantity: "",
    buyPrice: "", currentPrice: "", risk: "medium" as RiskLevel, date: today,
  });

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      id: crypto.randomUUID(),
      name: form.name,
      type: form.type,
      quantity: parseFloat(form.quantity) || 0,
      buyPrice: parseFloat(form.buyPrice) || 0,
      currentPrice: parseFloat(form.currentPrice) || parseFloat(form.buyPrice) || 0,
      risk: form.risk,
      date: form.date,
    });
    onClose();
  }

  const riskColors: Record<RiskLevel, string> = {
    low:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
    medium: "bg-amber-400/10 text-amber-400 border-amber-400/30",
    high:   "bg-rose-400/10 text-rose-400 border-rose-400/30",
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">{t("investments.add")}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("investments.asset_name")}</label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)}
              className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-gray-600 focus:outline-none focus:border-purple-400/40 transition-all"
              placeholder={t("investments.asset_placeholder")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("investments.type")}</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value as AssetType)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400/40">
                {ASSET_TYPES.map((t2) => <option key={t2} value={t2}>{t(`investments.types.${t2}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("investments.quantity")}</label>
              <input required type="number" min="0" step="any" value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400/40"
                placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("investments.buy_price")} ({symbol})</label>
              <input required type="number" min="0" step="any" value={form.buyPrice}
                onChange={(e) => set("buyPrice", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400/40"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("investments.current_price")} ({symbol})</label>
              <input type="number" min="0" step="any" value={form.currentPrice}
                onChange={(e) => set("currentPrice", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400/40"
                placeholder={t("investments.current_price_placeholder")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("investments.date")}</label>
              <input type="date" required value={form.date} onChange={(e) => set("date", e.target.value)}
                className="w-full bg-white/5 border border-white/8 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t("investments.risk")}</label>
              <div className="flex gap-1.5">
                {RISK_LEVELS.map((r) => (
                  <button key={r} type="button" onClick={() => set("risk", r)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border capitalize transition-all ${form.risk === r ? riskColors[r] : "bg-white/3 text-gray-500 border-white/8 hover:border-white/15"}`}>
                    {t(`investments.risk_${r}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-white/10 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-all">
              {t("common.cancel")}
            </button>
            <button type="submit"
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white rounded-xl text-sm font-semibold transition-all">
              {t("common.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
