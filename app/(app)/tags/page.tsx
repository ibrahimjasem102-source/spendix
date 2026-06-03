"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag as TagIcon, Plus, Pencil, Trash2, X, Check,
  Hash, ChevronDown, Loader2,
} from "lucide-react";
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, useTransactions } from "@/lib/query/hooks";
import { useTranslation } from "@/lib/i18n";
import { useGuest } from "@/contexts/GuestContext";
import { spring, tapTransition } from "@/lib/motion";
import ConfirmModal from "@/components/ui/ConfirmModal";
import TransactionRow from "@/components/transactions/TransactionRow";
import type { Tag } from "@/types";

const COLORS = [
  "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#F97316", "#3B82F6", "#14B8A6", "#A855F7",
];

// ── Tag pill ──────────────────────────────────────────────────
function TagPill({ tag, size = "sm" }: { tag: Pick<Tag, "name" | "color">; size?: "xs" | "sm" }) {
  const px = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${px}`}
      style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
    >
      <Hash className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {tag.name}
    </span>
  );
}

// ── Inline create / edit form ─────────────────────────────────
function TagForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Tag;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName]   = useState(initial?.name  ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }} transition={spring}
      onSubmit={submit}
      className="card p-4 space-y-3"
    >
      <p className="text-sm font-bold t1">{initial ? t("tags.edit") : t("tags.new")}</p>

      <input
        autoFocus
        type="text"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("tags.name_placeholder")}
        className="field text-sm"
      />

      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button
            key={c} type="button"
            onClick={() => setColor(c)}
            className="w-7 h-7 rounded-full transition-all flex items-center justify-center"
            style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px hsl(var(--bg-card)), 0 0 0 4px ${c}` : "none" }}
          >
            {color === c && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>

      {name.trim() && (
        <div className="flex items-center gap-2">
          <TagPill tag={{ name: name.trim(), color }} />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <motion.button
          type="submit" disabled={!name.trim() || loading}
          whileTap={{ scale: 0.97 }} transition={tapTransition}
          className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <><Check className="w-4 h-4" />{t("common.save")}</>}
        </motion.button>
        <button type="button" onClick={onCancel}
          className="btn-ghost px-4 py-2.5 text-sm flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.form>
  );
}

// ── Single tag row with inline transaction expansion ──────────
function TagRow({
  tag,
  transactions,
  onEdit,
  onDelete,
  t,
}: {
  tag: Tag;
  transactions: ReturnType<typeof useTransactions>["data"];
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  const tagTxs = useMemo(
    () => (transactions ?? []).filter((tx) => tx.tags?.some((tg) => tg.id === tag.id)),
    [transactions, tag.id],
  );

  const count = tagTxs.length > 0 ? tagTxs.length : (tag.transaction_count ?? 0);

  return (
    <div className="border-b border-[hsl(var(--border-2))] last:border-0">
      {/* Main row */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Pill + count — tap to expand */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 min-w-0 text-start"
        >
          <TagPill tag={tag} />
          <span className="text-xs t3 tabular-nums shrink-0">
            {count} {t("tags.transactions")}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 t3 ms-auto shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {/* Action buttons — always visible */}
        <div className="flex items-center gap-1 shrink-0 ms-2">
          <button
            onClick={onEdit}
            className="p-2 rounded-xl t3 hover:text-cyan-400 hover:bg-cyan-400/10 active:scale-95 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl t3 hover:text-rose-400 hover:bg-rose-400/10 active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline transaction list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="tx-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="mx-4 mb-3 rounded-2xl overflow-hidden"
              style={{ backgroundColor: "hsl(var(--bg-input))", border: "1px solid hsl(var(--border-2))" }}
            >
              {tagTxs.length === 0 ? (
                <p className="py-6 text-center text-xs t3">{t("tags.no_transactions")}</p>
              ) : (
                <div className="space-y-2 p-2">
                  {tagTxs.map((tx) => (
                    <TransactionRow key={tx.id} transaction={tx} density="compact" />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function TagsPage() {
  const { t } = useTranslation();
  const { isLoading } = useGuest();

  const { data: tags = [], isLoading: tagsLoading } = useTags(!isLoading);
  const { data: transactions = [] } = useTransactions(!isLoading);

  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);

  // Dispatch nav-hide while create/edit form is open on mobile
  useEffect(() => {
    const open = showCreate || editingId !== null;
    window.dispatchEvent(new CustomEvent(open ? "spendix:nav-hide" : "spendix:nav-show"));
    return () => { window.dispatchEvent(new CustomEvent("spendix:nav-show")); };
  }, [showCreate, editingId]);

  async function handleCreate(name: string, color: string) {
    await createTag.mutateAsync({ name, color });
    setShowCreate(false);
  }

  async function handleUpdate(id: string, name: string, color: string) {
    await updateTag.mutateAsync({ id, data: { name, color } });
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await deleteTag.mutateAsync(id);
    setConfirmId(null);
  }

  const confirmTag = tags.find((tg) => tg.id === confirmId);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-400/10">
            <TagIcon className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold t1">{t("tags.title")}</h1>
            <p className="text-xs t3 mt-0.5">{t("tags.subtitle")}</p>
          </div>
        </div>
        {!showCreate && !editingId && (
          <motion.button
            whileTap={{ scale: 0.95 }} transition={tapTransition}
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm flex items-center gap-1.5 px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            {t("tags.add")}
          </motion.button>
        )}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <TagForm
            key="create"
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            loading={createTag.isPending}
          />
        )}
      </AnimatePresence>

      {/* Tags list */}
      {tagsLoading ? (
        <div className="py-16 flex items-center justify-center gap-2 t3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      ) : tags.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="card py-20 flex flex-col items-center gap-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-pink-400/10 flex items-center justify-center">
            <Hash className="w-6 h-6 text-pink-400 opacity-50" />
          </div>
          <p className="text-sm font-semibold t1">{t("tags.empty")}</p>
          <p className="text-xs t3 text-center max-w-[220px]">{t("tags.empty_sub")}</p>
          <motion.button
            whileTap={{ scale: 0.95 }} transition={tapTransition}
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm flex items-center gap-1.5 px-4 py-2 mt-1"
          >
            <Plus className="w-4 h-4" />
            {t("tags.add")}
          </motion.button>
        </motion.div>
      ) : (
        <div className="card overflow-hidden">
          <AnimatePresence initial={false}>
            {tags.map((tag) => {
              if (editingId === tag.id) {
                return (
                  <motion.div
                    key={tag.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="p-4 border-b border-[hsl(var(--border-2))] last:border-0"
                  >
                    <TagForm
                      initial={tag}
                      onSave={(name, color) => handleUpdate(tag.id, name, color)}
                      onCancel={() => setEditingId(null)}
                      loading={updateTag.isPending}
                    />
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={tag.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  layout
                >
                  <TagRow
                    tag={tag}
                    transactions={transactions}
                    onEdit={() => { setEditingId(tag.id); setShowCreate(false); }}
                    onDelete={() => setConfirmId(tag.id)}
                    t={t}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmId && confirmTag && (
          <ConfirmModal
            title={`${t("common.delete")} #${confirmTag.name}`}
            message={t("tags.delete_confirm")}
            onConfirm={() => handleDelete(confirmId)}
            onCancel={() => setConfirmId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
