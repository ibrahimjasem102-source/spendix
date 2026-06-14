"use client";

import { useEffect, useState, type ElementType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  FileText,
  UserRound,
  X,
  Users,
  ArrowRight,
} from "lucide-react";
import { FormShell, FormFooter, FormSaveBtn } from "@/components/ui/FormShell";
import { Debt, DebtFormData, DebtType, FinancialContact } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { safeFetch } from "@/lib/fetch-safe";
import ContactSelector from "@/components/contacts/ContactSelector";
import { tapTransition } from "@/lib/motion";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import Link from "next/link";

interface Props {
  initial?: Debt;
  initialDebtType?: DebtType;
  onSubmit: (data: DebtFormData) => Promise<void>;
  onClose: () => void;
}

const TYPE_CONFIG: Record<DebtType, { icon: ElementType; color: string; bg: string; soft: string; ring: string }> = {
  payable: {
    icon: ArrowUpFromLine,
    color: "text-rose-400",
    bg: "bg-rose-400/10",
    soft: "bg-rose-400/5",
    ring: "#fb7185",
  },
  receivable: {
    icon: ArrowDownToLine,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    soft: "bg-emerald-400/5",
    ring: "#34d399",
  },
};

const QUICK_AMOUNTS = [50, 100, 250, 500];

export default function DebtForm({ initial, initialDebtType, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const isEdit = !!initial;

  const [form, setForm] = useState<DebtFormData>({
    person_or_entity: initial?.person_or_entity ?? "",
    debt_type:        initial?.debt_type ?? initialDebtType ?? "payable",
    total_amount:     initial?.total_amount ?? 0,
    due_date:         initial?.due_date ?? null,
    notes:            initial?.notes ?? null,
    contact_id:       initial?.contact_id ?? null,
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

  function set<K extends keyof DebtFormData>(key: K, value: DebtFormData[K]) {
    if (error) setError("");
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function setAmount(value: string) {
    setRawAmount(value);
    set("total_amount", parseFloat(value) || 0);
  }

  function handleContactChange(id: string | null, name: string) {
    if (error) setError("");
    setForm((previous) => ({
      ...previous,
      contact_id: id,
      person_or_entity: id
        ? (name || previous.person_or_entity)
        : (previous.contact_id ? "" : previous.person_or_entity),
    }));
  }

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    // Contact is required when the contacts table is available
    if (contactsAvailable && !form.contact_id) {
      setError(t("debts.contact_required"));
      return;
    }
    if (!form.person_or_entity.trim() && !form.contact_id) {
      setError(t("debts.creditor") + " " + t("transactions.title_required"));
      return;
    }
    if (form.total_amount <= 0) {
      setError(t("transactions.amount_positive"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        person_or_entity: form.person_or_entity.trim() || form.person_or_entity,
        total_amount: Number(form.total_amount),
        notes: form.notes?.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknown_error"));
      setLoading(false);
    }
  }

  const cfg = TYPE_CONFIG[form.debt_type];
  const TypeIcon = cfg.icon;
  const amount = Number(form.total_amount) || 0;
  const selectedContact = contacts.find((c) => c.id === form.contact_id);
  const personLabel = selectedContact?.name || form.person_or_entity.trim() || t("debts.creditor_placeholder");

  return (
    <FormShell onClose={onClose} maxWidth="sm:max-w-md">
      <div className="relative shrink-0 px-5 pb-4 pt-5" style={{ background: `${cfg.ring}10` }}>
        <div className="mb-2 sm:hidden">
          <SheetDragHandle onClose={onClose} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`shrink-0 rounded-xl p-2.5 ring-1 ring-white/5 ${cfg.bg}`}>
              <TypeIcon className={`h-5 w-5 ${cfg.color}`} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold t1">
                {isEdit ? t("debts.edit") : t("debts.add")}
              </h2>
              <p className="truncate text-xs t3">{t(`debts.${form.debt_type}`)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 t3 transition-all hover:bg-white/5 hover:t1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">

          {/* ── 1. Contact (required) ──────────────────────────────── */}
          <section className="space-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/50 p-4">
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide t3">
              <UserRound className="h-3.5 w-3.5" />
              {t("debts.select_contact")}
              <span className="text-rose-400 font-black">*</span>
            </label>

            {contactsAvailable ? (
              <ContactSelector
                value={form.contact_id ?? null}
                onChange={handleContactChange}
                contacts={contacts}
                onContactCreated={(contact) => {
                  setContacts((previous) => [...previous, contact]);
                  handleContactChange(contact.id, contact.name);
                }}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-3">
                <Users className="h-4 w-4 t3 shrink-0" />
                <p className="text-xs t3 flex-1">{t("debts.no_contacts_hint")}</p>
                <Link
                  href="/contacts"
                  onClick={onClose}
                  className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors shrink-0"
                >
                  {t("contacts.add")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </section>

          {/* ── 2. Amount ──────────────────────────────────────────── */}
          <div className="text-center">
            <p className="text-[10px] font-semibold t3 uppercase tracking-[0.14em] mb-3">
              {t("debts.total_amount")}
            </p>
            <div className="relative flex items-center justify-center gap-2">
              <span className="text-xl font-bold t3 select-none">{symbol}</span>
              <input
                type="number" inputMode="decimal" min="0.01" step="0.01"
                value={rawAmount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-5xl font-bold bg-transparent border-none outline-none tabular-nums text-center w-48 placeholder:text-[hsl(var(--text-3))] number-display"
                style={{ color: rawAmount ? cfg.ring : undefined }}
              />
              {rawAmount && (
                <button type="button" onClick={() => setAmount("")}
                  className="absolute -end-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[hsl(var(--bg-input))] flex items-center justify-center t3 hover:t1 transition-all">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {QUICK_AMOUNTS.map((v) => (
                <motion.button key={v} type="button"
                  onClick={() => setAmount(String(v))}
                  whileTap={{ scale: 0.94 }} transition={tapTransition}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  style={{ backgroundColor: `${cfg.ring}15`, color: cfg.ring, borderColor: `${cfg.ring}40` }}>
                  {symbol}{v}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-[hsl(var(--border-2))]" />

          {/* ── 3. Type ────────────────────────────────────────────── */}
          <div className="flex gap-1 rounded-xl bg-[hsl(var(--bg-input))] p-1">
            {(["payable", "receivable"] as DebtType[]).map((type) => {
              const typeCfg = TYPE_CONFIG[type];
              const Icon = typeCfg.icon;
              const active = form.debt_type === type;
              return (
                <motion.button
                  key={type} type="button"
                  onClick={() => set("debt_type", type)}
                  whileTap={{ scale: 0.97 }} transition={tapTransition}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={active
                    ? { backgroundColor: `${typeCfg.ring}18`, color: typeCfg.ring, boxShadow: `0 0 0 1.5px ${typeCfg.ring}30` }
                    : { color: "hsl(var(--text-3))" }}
                >
                  <Icon className="h-4 w-4" />
                  {t(`debts.${type}`)}
                </motion.button>
              );
            })}
          </div>

          {/* ── 4. Date + Notes ────────────────────────────────────── */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide t3">
                <CalendarDays className="h-3.5 w-3.5" />
                {t("debts.due_date")}
                <span className="font-normal normal-case opacity-50">({t("transactions.notes_optional")})</span>
              </label>
              <input
                type="date"
                value={form.due_date ?? ""}
                onChange={(event) => set("due_date", event.target.value || null)}
                className="field"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide t3">
                <FileText className="h-3.5 w-3.5" />
                {t("transactions.notes")}
                <span className="font-normal normal-case opacity-50">({t("transactions.notes_optional")})</span>
              </label>
              <input
                value={form.notes ?? ""}
                onChange={(event) => set("notes", event.target.value || null)}
                className="field"
                placeholder={t("transactions.notes_placeholder")}
              />
            </div>
          </section>

          {/* ── 5. Preview card ────────────────────────────────────── */}
          <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))]/40 p-3">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${cfg.bg}`}>
                <TypeIcon className={`h-4 w-4 ${cfg.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold t1">{personLabel}</p>
                <p className="truncate text-[11px] t3">
                  {t(`debts.${form.debt_type}`)}
                  {form.due_date ? ` · ${t("debts.due", { date: form.due_date })}` : ""}
                </p>
              </div>
              <p className={`shrink-0 text-sm font-black number-display ${cfg.color}`}>
                {amount > 0 ? `${symbol} ${amount.toLocaleString()}` : `${symbol} 0`}
              </p>
            </div>
          </section>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <FormFooter>
          <FormSaveBtn
            loading={loading}
            disabled={form.total_amount <= 0}
            accentHex={cfg.ring}
            icon={<TypeIcon className="h-4 w-4" />}
            label={isEdit ? t("debts.save_edit") : t("debts.add")}
          />
        </FormFooter>
      </form>
    </FormShell>
  );
}
