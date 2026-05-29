"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpFromLine, ArrowDownToLine, Loader2 } from "lucide-react";
import { Debt, DebtFormData, DebtType, FinancialContact } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { safeFetch } from "@/lib/fetch-safe";
import ContactSelector from "@/components/contacts/ContactSelector";
import { spring, tapTransition } from "@/lib/motion";

interface Props {
  initial?: Debt;
  initialDebtType?: DebtType;
  onSubmit: (data: DebtFormData) => Promise<void>;
  onClose: () => void;
}

const TYPE_CONFIG: Record<DebtType, { icon: React.ElementType; color: string; bg: string; ring: string; label: string }> = {
  payable:    { icon: ArrowUpFromLine,   color: "text-rose-400",    bg: "bg-rose-400/10",    ring: "#fb7185", label: "" },
  receivable: { icon: ArrowDownToLine,   color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "#34d399", label: "" },
};

export default function DebtForm({ initial, initialDebtType, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const isEdit = !!initial;

  const [form, setForm] = useState<DebtFormData>({
    person_or_entity: initial?.person_or_entity ?? "",
    debt_type:        initial?.debt_type        ?? initialDebtType ?? "payable",
    total_amount:     initial?.total_amount     ?? 0,
    due_date:         initial?.due_date         ?? null,
    notes:            initial?.notes            ?? null,
    contact_id:       initial?.contact_id       ?? null,
  });
  const [rawAmount, setRawAmount]               = useState(initial?.total_amount ? String(initial.total_amount) : "");
  const [contacts, setContacts]                 = useState<FinancialContact[]>([]);
  const [contactsAvailable, setContactsAvailable] = useState(true);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState("");

  useEffect(() => {
    safeFetch("/api/contacts")
      .then((r) => r.json())
      .then(({ contacts: c, contactsAvailable: available }) => {
        setContacts(c ?? []);
        setContactsAvailable(available !== false);
      })
      .catch(() => setContactsAvailable(false));
  }, []);

  function set<K extends keyof DebtFormData>(k: K, v: DebtFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleContactChange(id: string | null, name: string) {
    setForm((prev) => ({
      ...prev,
      contact_id: id,
      person_or_entity: name && (id || !prev.person_or_entity) ? name : prev.person_or_entity,
    }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.total_amount <= 0) { setError(t("transactions.amount_positive")); return; }
    if (!form.person_or_entity.trim()) { setError(t("debts.creditor") + " " + t("transactions.title_required")); return; }
    setLoading(true); setError("");
    try { await onSubmit(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : t("common.unknown_error")); setLoading(false); }
  }

  const cfg = TYPE_CONFIG[form.debt_type];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(19,26,34,0.68)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }} transition={spring}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "92dvh" }}>

        {/* Header */}
        <div className="shrink-0 relative px-5 pt-5 pb-4" style={{ background: `${cfg.ring}12` }}>
          <div className="w-10 h-1 rounded-full bg-white/10 mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${cfg.bg}`}>
                <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
              </div>
              <div>
                <h2 className="text-sm font-bold t1">
                  {isEdit ? t("debts.edit") : t("debts.add")}
                </h2>
                <p className="text-xs t3">{t(`debts.${form.debt_type}`)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl t3 hover:t1 hover:bg-white/5 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <div className="px-5 py-4 space-y-5 flex-1">

            {/* Debt type */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2.5">
                {t("debts.debt_type")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["payable", "receivable"] as DebtType[]).map((type) => {
                  const c = TYPE_CONFIG[type];
                  const active = form.debt_type === type;
                  return (
                    <motion.button key={type} type="button"
                      onClick={() => set("debt_type", type)}
                      whileTap={{ scale: 0.97 }} transition={tapTransition}
                      className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all ${
                        active ? `${c.bg} border-2` : "bg-[hsl(var(--bg-input))] border-[hsl(var(--border))]"
                      }`}
                      style={active ? { borderColor: `${c.ring}60` } : {}}>
                      <div className={`p-1.5 rounded-xl ${active ? c.bg : "bg-white/5"}`}>
                        <c.icon className={`w-4 h-4 ${active ? c.color : "t3"}`} />
                      </div>
                      <div className="text-start">
                        <p className={`text-xs font-semibold ${active ? c.color : "t2"}`}>{t(`debts.${type}`)}</p>
                        <p className="text-[10px] t3 leading-tight mt-0.5">{t(`debts.${type}_hint`)}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Contact selector */}
            {contactsAvailable ? (
              <ContactSelector
                value={form.contact_id ?? null}
                onChange={handleContactChange}
                contacts={contacts}
                onContactCreated={(c) => setContacts((p) => [...p, c])}
              />
            ) : (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2">
                <p className="text-xs text-amber-300">{t("contacts.setup_required")}</p>
              </div>
            )}

            {/* Person / entity */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("debts.creditor")}
              </label>
              <input required value={form.person_or_entity}
                onChange={(e) => set("person_or_entity", e.target.value)}
                className="field" placeholder={t("debts.creditor_placeholder")} />
            </div>

            {/* Amount — large */}
            <div>
              <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                {t("debts.total_amount")}
              </label>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-xl font-bold t3">{symbol}</span>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={rawAmount}
                  onChange={(e) => { setRawAmount(e.target.value); set("total_amount", parseFloat(e.target.value) || 0); }}
                  placeholder="0.00"
                  className="w-full ps-10 pe-4 py-4 text-3xl font-bold number-display rounded-2xl bg-[hsl(var(--bg-input))] border focus:outline-none transition-all"
                  style={{
                    color: rawAmount ? cfg.ring : undefined,
                    borderColor: rawAmount ? `${cfg.ring}40` : "hsl(var(--border))",
                  }} />
              </div>
            </div>

            {/* Due date + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("debts.due_date")}
                  <span className="ms-1 normal-case font-normal opacity-60">({t("transactions.notes_optional")})</span>
                </label>
                <input type="date" value={form.due_date ?? ""}
                  onChange={(e) => set("due_date", e.target.value || null)}
                  className="field" />
              </div>
              <div>
                <label className="block text-xs font-medium t3 uppercase tracking-wide mb-2">
                  {t("transactions.notes")}
                  <span className="ms-1 normal-case font-normal opacity-60">({t("transactions.notes_optional")})</span>
                </label>
                <input value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value || null)}
                  className="field" placeholder={t("transactions.notes_placeholder")} />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 8px))" }}>
            <motion.button type="submit" disabled={loading || form.total_amount <= 0}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${cfg.ring}, ${cfg.ring}bb)` }}>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />{t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <cfg.icon className="w-4 h-4" />
                    {isEdit ? t("debts.save_edit") : t("debts.add")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
