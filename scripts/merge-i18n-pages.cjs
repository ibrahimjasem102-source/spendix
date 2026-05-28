const fs = require("fs");

const patches = {
  en: {
    analytics: {
      trends_subtitle: "Income, expenses and savings over time",
      weekly_breakdown: "Weekly breakdown by category",
      week: "Week",
      budget_tracking: "How you are tracking against your monthly budgets",
      budget: "Budget",
      spent: "Spent",
    },
    budgets: {
      overall: "Overall Budget",
      used: "{{percent}}% of total budget used",
      categories_count: "{{count}} categories",
      over: "Over",
      near_limit: "Near limit",
    },
    ledger: {
      title: "Unified Ledger",
      total_entries: "{{count}} total entries",
      filters: "Filters",
      direction: "Direction",
      all_flows: "All flows",
      inflow_only: "Inflow only",
      outflow_only: "Outflow only",
      from_date: "From date",
      to_date: "To date",
      search: "Search ledger entries...",
      showing: "Showing {{visible}} of {{total}} entries",
      matching: "matching {{query}}",
      total_inflow: "Total Inflow",
      total_outflow: "Total Outflow",
    },
  },
  de: {
    analytics: {
      trends_subtitle: "Einnahmen, Ausgaben und Ersparnisse im Verlauf",
      weekly_breakdown: "Woechentliche Aufschluesselung nach Kategorie",
      week: "Woche",
      budget_tracking: "So liegst du im Vergleich zu deinen Monatsbudgets",
      budget: "Budget",
      spent: "Ausgegeben",
    },
    budgets: {
      overall: "Gesamtbudget",
      used: "{{percent}}% des Gesamtbudgets genutzt",
      categories_count: "{{count}} Kategorien",
      over: "Ueber Limit",
      near_limit: "Nahe am Limit",
    },
    ledger: {
      title: "Einheitliches Hauptbuch",
      total_entries: "{{count}} Eintraege insgesamt",
      filters: "Filter",
      direction: "Richtung",
      all_flows: "Alle Fluesse",
      inflow_only: "Nur Zufluss",
      outflow_only: "Nur Abfluss",
      from_date: "Von Datum",
      to_date: "Bis Datum",
      search: "Hauptbucheintraege suchen...",
      showing: "Zeige {{visible}} von {{total}} Eintraegen",
      matching: "passend zu {{query}}",
      total_inflow: "Gesamtzufluss",
      total_outflow: "Gesamtabfluss",
    },
  },
  ar: {
    analytics: {
      trends_subtitle: "الدخل والمصروفات والادخار عبر الزمن",
      weekly_breakdown: "تفصيل أسبوعي حسب الفئة",
      week: "الأسبوع",
      budget_tracking: "مدى التزامك بميزانياتك الشهرية",
      budget: "الميزانية",
      spent: "المنفق",
    },
    budgets: {
      overall: "الميزانية الإجمالية",
      used: "تم استخدام {{percent}}% من الميزانية الإجمالية",
      categories_count: "{{count}} فئات",
      over: "متجاوزة",
      near_limit: "قريبة من الحد",
    },
    ledger: {
      title: "دفتر الأستاذ الموحد",
      total_entries: "{{count}} قيد إجمالي",
      filters: "الفلاتر",
      direction: "الاتجاه",
      all_flows: "كل التدفقات",
      inflow_only: "الوارد فقط",
      outflow_only: "الصادر فقط",
      from_date: "من تاريخ",
      to_date: "إلى تاريخ",
      search: "ابحث في قيود الدفتر...",
      showing: "عرض {{visible}} من {{total}} قيد",
      matching: "مطابقة لـ {{query}}",
      total_inflow: "إجمالي الوارد",
      total_outflow: "إجمالي الصادر",
    },
  },
};

function merge(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] = merge(
        target[key] && typeof target[key] === "object" ? target[key] : {},
        value
      );
    } else {
      target[key] = value;
    }
  }
  return target;
}

for (const [locale, patch] of Object.entries(patches)) {
  const file = `locales/${locale}/common.json`;
  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, `${JSON.stringify(merge(current, patch), null, 2)}\n`, "utf8");
}
