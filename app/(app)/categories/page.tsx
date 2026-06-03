"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Check,
  CornerDownRight,
  CreditCard,
  Info,
  Layers3,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import CategoryIcon from "@/components/categories/CategoryIcon";
import SheetDragHandle from "@/components/ui/SheetDragHandle";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type CategoryFormData,
} from "@/lib/query/hooks";
import { COLOR_PALETTE, ICON_MAP, type CategorySection } from "@/lib/categories";
import { useTranslation } from "@/lib/i18n";
import { spring, tapTransition } from "@/lib/motion";
import type { Category } from "@/types";

const SECTIONS: Array<{
  id: CategorySection;
  Icon: React.ElementType;
  color: string;
  bg: string;
  defaultType: "income" | "expense";
  descKey: string;
  useKey: string;
}> = [
  {
    id: "expense", Icon: ArrowDownRight, color: "text-rose-400", bg: "bg-rose-400/10", defaultType: "expense",
    descKey: "categories.section_descriptions.expense", useKey: "categories.section_uses.expense",
  },
  {
    id: "income", Icon: ArrowUpRight, color: "text-emerald-400", bg: "bg-emerald-400/10", defaultType: "income",
    descKey: "categories.section_descriptions.income", useKey: "categories.section_uses.income",
  },
  {
    id: "work", Icon: Briefcase, color: "text-cyan-400", bg: "bg-cyan-400/10", defaultType: "income",
    descKey: "categories.section_descriptions.work", useKey: "categories.section_uses.work",
  },
  {
    id: "investment", Icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-400/10", defaultType: "expense",
    descKey: "categories.section_descriptions.investment", useKey: "categories.section_uses.investment",
  },
  {
    id: "debt", Icon: CreditCard, color: "text-amber-400", bg: "bg-amber-400/10", defaultType: "expense",
    descKey: "categories.section_descriptions.debt", useKey: "categories.section_uses.debt",
  },
];

const ICON_NAMES = Object.keys(ICON_MAP);

function sectionFor(category: Category): CategorySection {
  if (
    category.section === "work" ||
    category.section === "investment" ||
    category.section === "debt"
  ) return category.section;
  return category.type === "income" ? "income" : "expense";
}

function orderCategories(items: Category[]) {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string, Category[]>();
  const roots: Category[] = [];

  items.forEach((item) => {
    if (item.parent_id && ids.has(item.parent_id)) {
      children.set(item.parent_id, [...(children.get(item.parent_id) ?? []), item]);
    } else {
      roots.push(item);
    }
  });

  return roots.flatMap((root) => [root, ...(children.get(root.id) ?? [])]);
}

function childIdsOf(categories: Category[], categoryId: string) {
  return new Set(categories.filter((category) => category.parent_id === categoryId).map((category) => category.id));
}

function CategorySheet({
  initial,
  parent,
  categories,
  section,
  onClose,
}: {
  initial?: Category;
  parent?: Category;
  categories: Category[];
  section: CategorySection;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const sectionConfig = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];
  const [form, setForm] = useState<CategoryFormData>({
    name: initial?.name ?? "",
    type: initial?.type ?? sectionConfig.defaultType,
    color: initial?.color ?? COLOR_PALETTE[0],
    icon: initial?.icon ?? ICON_NAMES[0],
    section: initial?.section ?? section,
    parent_id: initial?.parent_id ?? parent?.id ?? null,
  });
  const [error, setError] = useState("");
  const busy = createCategory.isPending || updateCategory.isPending;
  const blockedParentIds = initial ? childIdsOf(categories, initial.id) : new Set<string>();
  const parentOptions = categories.filter((category) =>
    sectionFor(category) === section &&
    category.id !== initial?.id &&
    !blockedParentIds.has(category.id) &&
    !category.parent_id
  );
  const selectedParent = categories.find((category) => category.id === form.parent_id);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("spendix:nav-hide"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError(t("categories.name_required"));
      return;
    }

    const payload: CategoryFormData = {
      ...form,
      name: form.name.trim(),
      section,
      type: sectionConfig.defaultType,
      parent_id: form.parent_id ?? null,
    };

    if (initial) await updateCategory.mutateAsync({ id: initial.id, data: payload });
    else await createCategory.mutateAsync(payload);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.form
        onSubmit={submit}
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={spring}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="pt-2 sm:hidden">
          <SheetDragHandle onClose={onClose} />
        </div>
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-2.5 ${sectionConfig.bg}`}>
              <sectionConfig.Icon className={`h-5 w-5 ${sectionConfig.color}`} />
            </div>
            <div>
              <h2 className="text-base font-bold t1">
                {initial ? t("categories.edit") : t("categories.add")}
              </h2>
              <p className="text-xs t3">{t(`categories.sections.${section}`)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 t3 hover:bg-white/5 hover:t1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-card-2))] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] t3">{t("categories.preview")}</p>
            <div className="flex items-center gap-3">
              <CategoryIcon icon={form.icon} color={form.color} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold t1">{form.name.trim() || t("categories.name_placeholder_short")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${sectionConfig.bg} ${sectionConfig.color}`}>
                    {t(`categories.sections.${section}`)}
                  </span>
                  <span className="rounded-md bg-[hsl(var(--bg-input))] px-1.5 py-0.5 text-[10px] font-semibold t3">
                    {t(`transactions.${sectionConfig.defaultType}`)}
                  </span>
                  {selectedParent && (
                    <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                      {selectedParent.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed t3">{t(sectionConfig.useKey)}</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-input))]/45 p-4">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 t3" />
              <p className="text-xs font-bold t2">{t("categories.details")}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold t2">{t("categories.name")}</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="field"
                placeholder={t("categories.name_placeholder")}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold t2">{t("categories.parent")}</label>
              <select
                value={form.parent_id ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value || null }))}
                className="field"
              >
                <option value="">{t("categories.no_parent")}</option>
                {parentOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-relaxed t3">{t("categories.parent_hint")}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-input))]/45 p-4">
            <label className="text-xs font-bold t2">{t("categories.color_palette")}</label>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, color }))}
                  className="grid aspect-square place-items-center rounded-xl border transition-all"
                  style={{
                    backgroundColor: `${color}1A`,
                    borderColor: form.color === color ? color : "hsl(var(--border))",
                  }}
                >
                  {form.color === color && <Check className="h-3.5 w-3.5" style={{ color }} />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[hsl(var(--border-2))] bg-[hsl(var(--bg-input))]/45 p-4">
            <label className="text-xs font-bold t2">{t("categories.icon_palette")}</label>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {ICON_NAMES.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, icon }))}
                  className="grid aspect-square place-items-center rounded-xl border transition-all"
                  style={{
                    backgroundColor: form.icon === icon ? `${form.color}14` : "hsl(var(--bg-input))",
                    borderColor: form.icon === icon ? `${form.color}66` : "hsl(var(--border))",
                  }}
                >
                  <CategoryIcon icon={icon} color={form.color} size="xs" />
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-xl bg-rose-400/10 px-3 py-2 text-xs text-rose-400">{error}</p>}
        </div>

        <div className="shrink-0 border-t border-[hsl(var(--border))] px-5 pt-3" style={{ paddingBottom: "max(28px, calc(env(safe-area-inset-bottom, 0px) + 14px))" }}>
          <motion.button
            type="submit"
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            transition={tapTransition}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: form.color }}
          >
            {initial ? t("common.save") : t("categories.create")}
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useCategories();
  const deleteCategory = useDeleteCategory();
  const [active, setActive] = useState<CategorySection>("expense");
  const [sheet, setSheet] = useState<{ section: CategorySection; initial?: Category; parent?: Category } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<CategorySection, Category[]>();
    SECTIONS.forEach((section) => map.set(section.id, []));
    categories.forEach((category) => {
      const key = sectionFor(category);
      map.set(key, [...(map.get(key) ?? []), category]);
    });
    return map;
  }, [categories]);

  const visible = useMemo(() => {
    const source = grouped.get(active) ?? [];
    const term = query.trim().toLowerCase();
    const filtered = term
      ? source.filter((category) => category.name.toLowerCase().includes(term))
      : source;
    return orderCategories(filtered);
  }, [active, grouped, query]);
  const activeConfig = SECTIONS.find((section) => section.id === active) ?? SECTIONS[0];
  const totalCategories = categories.length;
  const largestSection = SECTIONS.reduce((best, section) => {
    const count = grouped.get(section.id)?.length ?? 0;
    const bestCount = grouped.get(best.id)?.length ?? 0;
    return count > bestCount ? section : best;
  }, SECTIONS[0]);

  async function confirmRemove() {
    if (!deletingCategory) return;
    const id = deletingCategory.id;
    setDeletingCategory(null);
    await deleteCategory.mutateAsync(id);
  }

  return (
    <div className="space-y-5 pb-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold t1">{t("categories.title")}</h1>
          <p className="mt-0.5 text-xs t3">{t("categories.subtitle")}</p>
        </div>
        <button
          onClick={() => setSheet({ section: active })}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-cyan-500"
        >
          <Plus className="h-4 w-4" />
          {t("categories.add")}
        </button>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <Layers3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold t1">{t("categories.guide_title")}</p>
            <p className="mt-0.5 text-xs leading-relaxed t3">{t("categories.guide_body")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-[hsl(var(--border-2))] sm:grid-cols-3">
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide t3">{t("categories.total")}</p>
            <p className="mt-1 text-lg font-black t1">{totalCategories}</p>
          </div>
          <div className="border-s border-[hsl(var(--border-2))] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide t3">{t("categories.most_used_section")}</p>
            <p className={`mt-1 text-sm font-bold ${largestSection.color}`}>{t(`categories.sections.${largestSection.id}`)}</p>
          </div>
          <div className="col-span-2 border-t border-[hsl(var(--border-2))] px-4 py-3 sm:col-span-1 sm:border-s sm:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide t3">{t("categories.active_section")}</p>
            <p className={`mt-1 text-sm font-bold ${activeConfig.color}`}>{t(`categories.sections.${active}`)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {SECTIONS.map(({ id, Icon, color, bg }) => {
          const selected = active === id;
          const count = grouped.get(id)?.length ?? 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`min-h-[92px] rounded-2xl border px-3 py-3 text-start transition-all ${
                selected ? `${bg} border-current ${color}` : "border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] t2 hover:t1"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </span>
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold">{count}</span>
              </div>
              <p className="text-sm font-bold">{t(`categories.sections.${id}`)}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed opacity-75">{t(SECTIONS.find((section) => section.id === id)?.descKey ?? "")}</p>
            </button>
          );
        })}
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
            <div className={`rounded-xl p-2 ${activeConfig.bg}`}>
              <activeConfig.Icon className={`h-4 w-4 ${activeConfig.color}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold t1">{t(`categories.sections.${active}`)}</h2>
              <p className="text-xs t3">{t("categories.section_count", { count: visible.length })}</p>
            </div>
            </div>
            <button
              type="button"
              onClick={() => setSheet({ section: active })}
              className="rounded-xl p-2 t3 transition-colors hover:bg-[hsl(var(--bg-input))] hover:t1"
              aria-label={t("categories.add")}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed t3">{t(activeConfig.descKey)}</p>
          <div className="relative mt-3">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 t3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field ps-9 text-sm"
              placeholder={t("categories.search_placeholder")}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-white/5" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center px-4 py-16 text-center">
            <Layers3 className="mb-3 h-8 w-8 t3" />
            <p className="text-sm font-bold t1">{t("categories.empty")}</p>
            <button onClick={() => setSheet({ section: active })} className="mt-3 text-xs font-bold text-cyan-400">
              {t("categories.add_first")}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border-2))]">
            {visible.map((category) => {
              const parentCategory = categories.find((item) => item.id === category.parent_id);
              const isChild = Boolean(parentCategory);
              return (
              <div key={category.id} className={`flex items-center gap-3 px-4 py-3 ${isChild ? "ps-8" : ""}`}>
                <span className={`h-10 shrink-0 rounded-full ${isChild ? "w-0.5 opacity-60" : "w-1"}`} style={{ backgroundColor: category.color }} />
                <CategoryIcon icon={category.icon} color={category.color} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {isChild && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-cyan-300" />}
                    <p className="truncate text-sm font-bold t1">{category.name}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[hsl(var(--bg-input))] px-1.5 py-0.5 text-[10px] font-semibold t3">
                      {t(`transactions.${category.type}`)}
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${activeConfig.bg} ${activeConfig.color}`}>
                      {t(`categories.sections.${active}`)}
                    </span>
                    {isChild && parentCategory && (
                      <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                        {t("categories.subcategory_of", { name: parentCategory.name })}
                      </span>
                    )}
                  </div>
                </div>
                {!isChild && (
                  <button
                    onClick={() => setSheet({ section: active, parent: category })}
                    className="rounded-xl p-2 t3 transition-colors hover:bg-emerald-400/10 hover:text-emerald-300"
                    aria-label={t("categories.add_subcategory")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setSheet({ section: active, initial: category })}
                  className="rounded-xl p-2 t3 transition-colors hover:bg-cyan-400/10 hover:text-cyan-300"
                  aria-label={t("common.edit")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeletingCategory(category)}
                  disabled={deleteCategory.isPending}
                  className="rounded-xl p-2 t3 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );})}
          </div>
        )}
      </section>

      <AnimatePresence>
        {sheet && (
          <CategorySheet
            key="category-sheet"
            section={sheet.section}
            initial={sheet.initial}
            parent={sheet.parent}
            categories={categories}
            onClose={() => setSheet(null)}
          />
        )}
      </AnimatePresence>

      {deletingCategory && (
        <ConfirmModal
          message={t("categories.delete_confirm", { name: deletingCategory.name })}
          loading={deleteCategory.isPending}
          onConfirm={confirmRemove}
          onCancel={() => setDeletingCategory(null)}
        />
      )}
    </div>
  );
}
