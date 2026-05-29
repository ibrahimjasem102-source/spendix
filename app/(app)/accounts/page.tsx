"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, Building2, CreditCard, Wallet, PiggyBank,
  Plus, Pencil, Trash2, X, Check, ChevronDown, Star,
  TrendingUp, TrendingDown, AlertCircle,
} from "lucide-react";
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from "@/lib/query/hooks";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { spring, tapTransition } from "@/lib/motion";
import type { Account, AccountFormData, AccountType } from "@/types";

// ── Account type meta ────────────────────────────────────────

const ACCOUNT_META: Record<AccountType, { icon: React.ElementType; color: string; labelKey: string }> = {
  cash:        { icon: Banknote,    color: "#10B981", labelKey: "accounts.type_cash"        },
  bank:        { icon: Building2,   color: "#3B82F6", labelKey: "accounts.type_bank"        },
  credit_card: { icon: CreditCard,  color: "#8B5CF6", labelKey: "accounts.type_credit_card" },
  wallet:      { icon: Wallet,      color: "#F59E0B", labelKey: "accounts.type_wallet"      },
  savings:     { icon: PiggyBank,   color: "#06B6D4", labelKey: "accounts.type_savings"     },
};

const ACCOUNT_TYPES: AccountType[] = ["cash", "bank", "credit_card", "wallet", "savings"];

// ── Account Form Modal ───────────────────────────────────────

interface AccountFormProps {
  initial?: Account;
  onSubmit: (data: AccountFormData) => Promise<void>;
  onClose: () => void;
}

function AccountFormModal({ initial, onSubmit, onClose }: AccountFormProps) {
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [form, setForm] = useState<AccountFormData>({
    name:            initial?.name            ?? "",
    type:            initial?.type            ?? "bank",
    currency:        initial?.currency        ?? "USD",
    initial_balance: initial?.initial_balance ?? 0,
    color:           initial?.color           ?? null,
    is_default:      initial?.is_default      ?? false,
  });
  const [rawBalance, setRawBalance] = useState(initial?.initial_balance ? String(initial.initial_balance) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof AccountFormData>(k: K, v: AccountFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("accounts.name_required")); return; }
    setLoading(true); setError("");
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  const selectedMeta = ACCOUNT_META[form.type];
  const accent = selectedMeta.color;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={spring}
        className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[1.75rem] overflow-hidden flex flex-col"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))", maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ background: `${accent}10` }}>
          <div className="w-10 h-1 rounded-full bg-white/12 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold t3 uppercase tracking-widest">
              {isEdit ? t("accounts.edit") : t("accounts.new")}
            </p>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">

            {/* Account type selector */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-3">
                {t("accounts.type")}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ACCOUNT_TYPES.map((type) => {
                  const meta = ACCOUNT_META[type];
                  const Icon = meta.icon;
                  const isActive = form.type === type;
                  return (
                    <motion.button
                      key={type} type="button"
                      onClick={() => set("type", type)}
                      whileTap={{ scale: 0.93 }} transition={tapTransition}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all"
                      style={isActive ? {
                        backgroundColor: `${meta.color}14`,
                        borderColor: `${meta.color}45`,
                        borderWidth: 1.5,
                      } : {
                        backgroundColor: "hsl(var(--bg-input))",
                        borderColor: "hsl(var(--border))",
                      }}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: isActive ? `${meta.color}20` : "hsl(var(--bg-card-2))" }}>
                        <Icon className="w-4 h-4" style={{ color: isActive ? meta.color : "hsl(var(--text-3))" }} />
                      </div>
                      <span className="text-[8px] font-semibold text-center leading-tight"
                        style={{ color: isActive ? meta.color : "hsl(var(--text-3))" }}>
                        {t(meta.labelKey)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("accounts.name")}
              </label>
              <input
                type="text" required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="field text-sm font-medium"
                placeholder={t("accounts.name_placeholder")}
              />
            </div>

            {/* Initial balance */}
            <div>
              <label className="block text-[10px] font-semibold t3 uppercase tracking-[0.12em] mb-2">
                {t("accounts.initial_balance")}
              </label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={rawBalance}
                onChange={(e) => {
                  setRawBalance(e.target.value);
                  set("initial_balance", parseFloat(e.target.value) || 0);
                }}
                className="field text-sm"
                placeholder="0.00"
              />
              <p className="text-[10px] t3 mt-1.5">{t("accounts.initial_balance_hint")}</p>
            </div>

            {/* Set as default */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium t1">{t("accounts.set_default")}</p>
                <p className="text-[10px] t3">{t("accounts.set_default_hint")}</p>
              </div>
              <motion.button
                type="button"
                onClick={() => set("is_default", !form.is_default)}
                whileTap={{ scale: 0.92 }} transition={tapTransition}
                className="w-11 h-6 rounded-full relative transition-all shrink-0"
                style={{ backgroundColor: form.is_default ? accent : "hsl(var(--bg-input))" }}
              >
                <motion.div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ left: form.is_default ? "calc(100% - 22px)" : "2px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2.5 rounded-xl flex items-center gap-2"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <div className="px-5 pb-5 pt-2">
            <motion.button
              type="submit"
              disabled={loading || !form.name.trim()}
              whileTap={{ scale: 0.97 }} transition={tapTransition}
              className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}99 100%)`, boxShadow: `0 4px 20px ${accent}35` }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("common.saving")}
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    {isEdit ? t("accounts.save_edit") : t("accounts.add_account")}
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

// ── Delete Confirm ───────────────────────────────────────────

function DeleteConfirm({ account, onConfirm, onCancel }: { account: Account; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const meta = ACCOUNT_META[account.type];
  const Icon = meta.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(11,15,20,0.80)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={spring}
        className="w-full max-w-sm rounded-[1.75rem] p-6 space-y-4"
        style={{ backgroundColor: "hsl(var(--bg-card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${meta.color}14` }}>
            <Icon className="w-6 h-6" style={{ color: meta.color }} />
          </div>
          <div>
            <p className="font-bold t1">{account.name}</p>
            <p className="text-xs t3">{t(meta.labelKey)}</p>
          </div>
        </div>
        <p className="text-sm t2">{t("accounts.delete_confirm")}</p>
        <p className="text-xs t3">{t("accounts.delete_hint")}</p>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold t2 bg-[hsl(var(--bg-input))] hover:t1 transition-all">
            {t("common.cancel")}
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all">
            {t("common.delete")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Account Card ─────────────────────────────────────────────

interface AccountCardProps {
  account: Account;
  onEdit: (a: Account) => void;
  onDelete: (a: Account) => void;
}

function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const meta = ACCOUNT_META[account.type];
  const Icon = meta.icon;
  const balance = account.balance ?? account.initial_balance;
  const isPositive = balance >= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={spring}
      className="relative rounded-[1.5rem] p-4 flex flex-col gap-3 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${meta.color}10 0%, ${meta.color}06 100%)`,
        border: `1px solid ${meta.color}22`,
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${meta.color}18` }}>
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-sm t1 leading-tight">{account.name}</p>
              {account.is_default && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                  style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>
                  <Star className="w-2 h-2" />
                  {t("accounts.default")}
                </span>
              )}
            </div>
            <p className="text-[10px] t3 mt-0.5">{t(meta.labelKey)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <motion.button
            type="button" onClick={() => onEdit(account)}
            whileTap={{ scale: 0.88 }} transition={tapTransition}
            className="w-7 h-7 rounded-xl flex items-center justify-center t3 hover:t1 hover:bg-white/8 transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            type="button" onClick={() => onDelete(account)}
            whileTap={{ scale: 0.88 }} transition={tapTransition}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Balance */}
      <div>
        <p className="text-[10px] font-semibold t3 uppercase tracking-[0.1em] mb-0.5">{t("accounts.balance")}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl font-bold" style={{ color: meta.color }}>
            {format(Math.abs(balance))}
          </p>
          {!isPositive && (
            <span className="text-xs font-semibold text-rose-400">({t("accounts.negative")})</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: `${meta.color}18` }}>
        <div className="flex items-center gap-1 text-[10px] t3">
          {isPositive
            ? <TrendingUp className="w-3 h-3 text-emerald-400" />
            : <TrendingDown className="w-3 h-3 text-rose-400" />}
          {account.transaction_count ?? 0} {t("accounts.transactions")}
        </div>
        <div className="h-3 w-px bg-[hsl(var(--border-2))]" />
        <div className="text-[10px] t3">
          {t("accounts.initial")}: {format(account.initial_balance)}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function AccountsPage() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const { data: accounts = [], isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "balance">("balance");

  const totalBalance = accounts.reduce((s, a) => s + (a.balance ?? a.initial_balance), 0);
  const totalTransactions = accounts.reduce((s, a) => s + (a.transaction_count ?? 0), 0);

  const sorted = [...accounts].sort((a, b) => {
    if (sortBy === "balance") return (b.balance ?? b.initial_balance) - (a.balance ?? a.initial_balance);
    return a.name.localeCompare(b.name);
  });

  async function handleCreate(data: AccountFormData) {
    await createAccount.mutateAsync(data);
  }

  async function handleEdit(data: AccountFormData) {
    if (!editingAccount) return;
    await updateAccount.mutateAsync({ id: editingAccount.id, data });
  }

  async function handleDelete() {
    if (!deletingAccount) return;
    await deleteAccount.mutateAsync(deletingAccount.id);
    setDeletingAccount(null);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold t1">{t("accounts.title")}</h1>
          <p className="text-sm t3 mt-0.5">{t("accounts.subtitle")}</p>
        </div>
        <motion.button
          onClick={() => setShowForm(true)}
          whileTap={{ scale: 0.93 }} transition={tapTransition}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB)", boxShadow: "0 4px 16px #3B82F640" }}
        >
          <Plus className="w-4 h-4" />
          {t("accounts.add")}
        </motion.button>
      </div>

      {/* Summary card */}
      {accounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="rounded-[1.75rem] p-5"
          style={{
            background: "linear-gradient(135deg, #1E3A5F 0%, #0F2027 100%)",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-blue-300/70 uppercase tracking-[0.12em]">{t("accounts.total_balance")}</p>
              <p className="text-3xl font-bold text-white mt-1">{format(totalBalance)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-300/60">{accounts.length} {t("accounts.accounts")}</p>
              <p className="text-xs text-blue-300/60 mt-0.5">{totalTransactions} {t("accounts.transactions")}</p>
            </div>
          </div>

          {/* Account type distribution */}
          <div className="flex gap-2 flex-wrap">
            {ACCOUNT_TYPES.filter((type) => accounts.some((a) => a.type === type)).map((type) => {
              const meta = ACCOUNT_META[type];
              const Icon = meta.icon;
              const count = accounts.filter((a) => a.type === type).length;
              return (
                <div key={type} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                  style={{ backgroundColor: `${meta.color}18`, border: `1px solid ${meta.color}25` }}>
                  <Icon className="w-3 h-3" style={{ color: meta.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Sort / filter bar */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs t3">{t("accounts.sort_by")}:</span>
          {(["balance", "name"] as const).map((s) => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                sortBy === s
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                  : "t3 bg-[hsl(var(--bg-input))] border border-[hsl(var(--border))] hover:t2"
              }`}>
              {t(`accounts.sort_${s}`)}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[1.5rem] h-40 animate-pulse bg-[hsl(var(--bg-card-2))]" />
          ))}
        </div>
      )}

      {/* Account grid */}
      {!isLoading && sorted.length > 0 && (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {sorted.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={(a) => setEditingAccount(a)}
                onDelete={(a) => setDeletingAccount(a)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && sorted.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-center py-16 space-y-4"
        >
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8 text-blue-400/60" />
          </div>
          <div>
            <p className="font-bold t1 text-lg">{t("accounts.empty_title")}</p>
            <p className="text-sm t3 mt-1">{t("accounts.empty_subtitle")}</p>
          </div>
          <motion.button
            onClick={() => setShowForm(true)}
            whileTap={{ scale: 0.95 }} transition={tapTransition}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white mx-auto"
            style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB)" }}
          >
            <Plus className="w-4 h-4" />
            {t("accounts.add_first")}
          </motion.button>
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showForm || editingAccount) && (
          <AccountFormModal
            key="form"
            initial={editingAccount ?? undefined}
            onSubmit={editingAccount ? handleEdit : handleCreate}
            onClose={() => { setShowForm(false); setEditingAccount(null); }}
          />
        )}
        {deletingAccount && (
          <DeleteConfirm
            key="delete"
            account={deletingAccount}
            onConfirm={handleDelete}
            onCancel={() => setDeletingAccount(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
