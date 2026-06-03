"use client";

import { useMemo, useState } from "react";
import { Plus, AlertTriangle, Check, CheckCircle, ChevronDown, Search, Target, Loader2, Pencil, Trash2, Wallet } from "lucide-react";
import type { Budget, BudgetFormData, Category } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/useToast";
import ToastList from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import CategoryIcon from "@/components/categories/CategoryIcon";
import { useGuest } from "@/contexts/GuestContext";
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from "@/lib/query/hooks";

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - 2 + index);

function percentOf(spent: number, budget: number) {
  return budget > 0 ? Math.round((spent / budget) * 100) : 0;
}

function BudgetCategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = categories.find((category) => category.id === value);
  const parentById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => {
      const parentName = category.parent_id ? parentById.get(category.parent_id)?.name ?? "" : "";
      return `${category.name} ${parentName}`.toLowerCase().includes(query);
    });
  }, [categories, parentById, search]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={categories.length === 0}
        className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-start transition-all disabled:opacity-60"
        style={{ backgroundColor: "hsl(var(--bg-input))", borderColor: open ? "rgba(34,211,238,0.38)" : "hsl(var(--border))" }}
      >
        <span className="flex min-w-0 items-center gap-3">
          {selected ? (
            <CategoryIcon icon={selected.icon} color={selected.color} size="md" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
              <Target className="h-5 w-5 text-cyan-400" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-sm font-bold t1">
              {selected?.name ?? t("budgets.category")}
            </span>
            <span className="mt-0.5 block truncate text-[11px] t3">
              {selected?.parent_id
                ? t("categories.subcategory_of", { name: parentById.get(selected.parent_id)?.name ?? "" })
                : t("budgets.form_hint")}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 t3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ backgroundColor: "hsl(var(--bg-card-2))", borderColor: "hsl(var(--border))" }}
        >
          <div className="border-b border-[hsl(var(--border-2))] p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 t3" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("categories.search_placeholder")}
                className="h-10 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] ps-9 pe-3 text-sm font-semibold t1 outline-none"
              />
            </div>
          </div>

          <div className="max-h-[260px] space-y-1 overflow-y-auto p-2 overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm t3">{t("categories.empty")}</div>
            ) : (
              filtered.map((category) => {
                const isSelected = category.id === value;
                const parent = category.parent_id ? parentById.get(category.parent_id) : null;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      onChange(category.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-start transition-all ${
                      isSelected ? "border-cyan-400/35 bg-cyan-400/10" : "border-transparent hover:bg-[hsl(var(--bg-input))]"
                    }`}
                  >
                    <CategoryIcon icon={category.icon} color={category.color} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold t1">{category.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] t3">
                        {parent ? t("categories.subcategory_of", { name: parent.name }) : t("categories.no_parent")}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-slate-950">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetFormModal({
  initial,
  categories,
  month,
  year,
  loading,
  onClose,
  onSubmit,
}: {
  initial?: Budget;
  categories: Category[];
  month: number;
  year: number;
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: BudgetFormData) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<BudgetFormData>({
    category_id: initial?.category_id ?? categories[0]?.id ?? "",
    monthly_limit: initial?.monthly_limit ?? 0,
    month: initial?.month ?? month,
    year: initial?.year ?? year,
  });
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.category_id || Number(form.monthly_limit) <= 0) {
      setError(t("budgets.form_error"));
      return;
    }
    setError("");
    await onSubmit({ ...form, monthly_limit: Number(form.monthly_limit) });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center px-3 sm:p-4"
      style={{ backgroundColor: "rgba(19,26,34,0.68)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="modal-card mt-[calc(72px+env(safe-area-inset-top,0px))] w-full sm:mt-0 sm:max-w-md rounded-[1.5rem] p-5 space-y-4 overflow-y-auto overscroll-contain"
        style={{
          maxHeight: "calc(100dvh - 108px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold t1">
              {initial ? t("budgets.edit_budget") : t("budgets.new_budget")}
            </h2>
            <p className="text-xs t3 mt-1">{t("budgets.form_hint")}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost px-3 py-2">
            {t("common.cancel")}
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold t3 uppercase tracking-wide mb-2">
            {t("budgets.category")}
          </label>
          <BudgetCategoryPicker
            categories={categories}
            value={form.category_id}
            onChange={(categoryId) => setForm((prev) => ({ ...prev, category_id: categoryId }))}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold t3 uppercase tracking-wide mb-2">
            {t("budgets.monthly_limit")}
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={form.monthly_limit || ""}
            onChange={(event) => setForm((prev) => ({ ...prev, monthly_limit: Number(event.target.value) }))}
            className="field text-lg font-bold number-display"
            placeholder="0.00"
          />
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || categories.length === 0}
          className="w-full py-3 rounded-2xl text-sm font-bold text-[#0B0F14] bg-gradient-to-r from-cyan-500 to-cyan-400 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {initial ? t("common.save") : t("budgets.create_budget")}
        </button>
      </form>
    </div>
  );
}

export default function BudgetsPage() {
  const { t, formatDate } = useTranslation();
  const { format } = useCurrency();
  const { isGuest, isLoading } = useGuest();
  const { toasts, addToast, dismiss } = useToast();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Budget | undefined>();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const budgetsQuery = useBudgets(month, year, isGuest, !isLoading);
  const createBudget = useCreateBudget(month, year, isGuest);
  const updateBudget = useUpdateBudget(month, year, isGuest);
  const deleteBudget = useDeleteBudget(month, year, isGuest);

  const budgets = budgetsQuery.data?.budgets ?? [];
  const categories = budgetsQuery.data?.categories ?? [];
  const summary = budgetsQuery.data?.summary ?? {
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overBudgetCount: 0,
    nearLimitCount: 0,
  };
  const totalPercent = percentOf(summary.totalSpent, summary.totalBudget);
  const availableCategories = useMemo(() => {
    if (editing) return categories;
    const used = new Set(budgets.map((budget) => budget.category_id));
    return categories.filter((category) => !used.has(category.id));
  }, [budgets, categories, editing]);

  async function handleSubmit(data: BudgetFormData) {
    try {
      if (editing) {
        await updateBudget.mutateAsync({ id: editing.id, data });
      } else {
        await createBudget.mutateAsync(data);
      }
      addToast(t("budgets.saved"), "success");
      setShowForm(false);
      setEditing(undefined);
    } catch {
      addToast(t("budgets.save_failed"), "error");
      throw new Error("Budget save failed");
    }
  }

  async function handleDelete() {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    try {
      await deleteBudget.mutateAsync(id);
      addToast(t("budgets.deleted"), "success");
    } catch {
      addToast(t("budgets.delete_failed"), "error");
    }
  }

  const loading = budgetsQuery.isLoading;
  const formLoading = createBudget.isPending || updateBudget.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10">
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black t1">{t("budgets.title")}</h1>
            <p className="mt-0.5 text-xs font-medium t2">{t("budgets.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="field w-auto">
            {MONTHS.map((monthNumber) => (
              <option key={monthNumber} value={monthNumber}>
                {formatDate(new Date(year, monthNumber - 1, 1), { month: "long" })}
              </option>
            ))}
          </select>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="field w-auto">
            {YEARS.map((yearNumber) => <option key={yearNumber} value={yearNumber}>{yearNumber}</option>)}
          </select>
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-[#0B0F17] rounded-xl text-sm font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("budgets.new_budget")}
          </button>
        </div>
      </div>

      {budgetsQuery.isError && (
        <div className="card p-4 border-rose-400/20 bg-rose-400/5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-rose-400">{t("budgets.load_failed")}</p>
            <button onClick={() => void budgetsQuery.refetch()} className="btn-ghost text-xs">{t("common.retry")}</button>
          </div>
          <p className="text-xs text-rose-300/80 font-mono break-all">
            {(budgetsQuery.error as Error)?.message ?? "Unknown error"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: t("budgets.total_budget"), value: format(summary.totalBudget), icon: Target, color: "text-cyan-400", bg: "bg-cyan-400/10" },
          { label: t("budgets.total_spent"), value: format(summary.totalSpent), icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { label: t("budgets.over_budget"), value: t("budgets.categories_count", { count: summary.overBudgetCount }), icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-400/10" },
        ].map((item) => (
          <div key={item.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs t3 uppercase tracking-wide font-medium">{item.label}</p>
              <div className={`p-2 rounded-lg ${item.bg}`}><item.icon className={`w-3.5 h-3.5 ${item.color}`} /></div>
            </div>
            <p className={`text-xl font-bold number-display ${item.color}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium t1">{t("budgets.overall")}</p>
          <p className="text-sm t2">{format(summary.totalSpent)} / {format(summary.totalBudget)}</p>
        </div>
        <div className="h-2.5 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${summary.totalSpent > summary.totalBudget && summary.totalBudget > 0 ? "bg-rose-400" : "bg-gradient-to-r from-cyan-400 to-purple-500"}`}
            style={{ width: `${Math.min(totalPercent, 100)}%` }}
          />
        </div>
        <p className="text-xs t3 mt-1.5">{t("budgets.used", { percent: totalPercent })}</p>
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold t1">{t("budgets.by_category")}</h3>
          {budgetsQuery.isRefetching && <Loader2 className="w-4 h-4 t3 animate-spin" />}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-4 w-2/3 bg-[hsl(var(--bg-input))] rounded mb-2" />
                <div className="h-2 bg-[hsl(var(--bg-input))] rounded-full" />
              </div>
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon"><Wallet className="w-6 h-6 t3" /></div>
            <p className="empty-state-title">{t("budgets.empty_title")}</p>
            <p className="empty-state-body">{t("budgets.empty_body")}</p>
          </div>
        ) : (
          budgets.map((budget) => {
            const over = budget.status === "over";
            const warning = budget.status === "near_limit";
            const color = budget.category?.color ?? "#06B6D4";
            const barColor = over ? "#F43F5E" : warning ? "#F59E0B" : color;
            return (
              <div key={budget.id} className="group">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium t1 truncate">{budget.category?.name ?? t("transactions.uncategorized")}</span>
                    {over && <span className="text-xs text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded-md">{t("budgets.over")}</span>}
                    {warning && <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md">{t("budgets.near_limit")}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-end">
                      <span className="text-sm font-medium t1">{format(budget.spent)}</span>
                      <span className="text-sm t3"> / {format(budget.monthly_limit)}</span>
                      <span className={`ms-2 text-xs font-medium ${over ? "text-rose-400" : warning ? "text-amber-400" : "t3"}`}>{budget.percent}%</span>
                    </div>
                    <button onClick={() => { setEditing(budget); setShowForm(true); }} className="p-1.5 rounded-lg t3 hover:t1 hover:bg-[hsl(var(--bg-input))] transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmId(budget.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="h-1.5 bg-[hsl(var(--bg-input))] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(budget.percent, 100)}%`, backgroundColor: barColor }} />
                </div>
                <p className="text-[11px] t3 mt-1">{t("budgets.remaining")}: {format(budget.remaining)}</p>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <BudgetFormModal
          initial={editing}
          categories={availableCategories}
          month={month}
          year={year}
          loading={formLoading}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSubmit={handleSubmit}
        />
      )}

      {confirmId && (
        <ConfirmModal
          message={t("budgets.delete_message")}
          loading={deleteBudget.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}

      <ToastList toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
