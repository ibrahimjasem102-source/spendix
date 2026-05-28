"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight, Briefcase, Clock, DollarSign, Landmark,
  Loader2, Search, TrendingUp, X, Trash2,
} from "lucide-react";
import { safeFetch } from "@/lib/fetch-safe";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { spring } from "@/lib/motion";
import type { SearchResult } from "@/app/api/search/route";

const RECENTS_KEY = "spendix_recent_searches";
const MAX_RECENTS = 5;

const TYPE_ICON: Record<SearchResult["type"], React.ElementType> = {
  transaction:  ArrowUpRight,
  debt:         Landmark,
  investment:   TrendingUp,
  work_session: Briefcase,
  work_payment: DollarSign,
};

const TYPE_CFG: Record<SearchResult["type"], { color: string; bg: string; labelKey: string }> = {
  transaction:  { color: "text-cyan-400",    bg: "bg-cyan-400/10",    labelKey: "nav.transactions"    },
  debt:         { color: "text-orange-400",  bg: "bg-orange-400/10",  labelKey: "nav.debts"           },
  investment:   { color: "text-purple-400",  bg: "bg-purple-400/10",  labelKey: "nav.investments"     },
  work_session: { color: "text-emerald-400", bg: "bg-emerald-400/10", labelKey: "nav.work"            },
  work_payment: { color: "text-emerald-400", bg: "bg-emerald-400/10", labelKey: "actions.work_payment"},
};

const TYPE_ORDER: SearchResult["type"][] = ["transaction", "debt", "investment", "work_session", "work_payment"];

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-cyan-400/20 px-0.5 text-cyan-300 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function loadRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as string[]; }
  catch { return []; }
}

function saveRecent(term: string): string[] {
  const updated = [term, ...loadRecents().filter((s) => s !== term)].slice(0, MAX_RECENTS);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

function removeRecent(term: string): string[] {
  const updated = loadRecents().filter((s) => s !== term);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export default function GlobalSearch() {
  const router = useRouter();
  const { t }  = useTranslation();
  const { format } = useCurrency();

  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(-1);
  const [recents, setRecents] = useState<string[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setRecents(loadRecents()); }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setInputFocused(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setInputFocused(true);
      }
      if (e.key === "Escape") { setOpen(false); setInputFocused(false); setFocused(-1); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res  = await safeFetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data = await res.json() as { results: SearchResult[] };
      setResults(data.results ?? []);
      setOpen(true);
      setFocused(-1);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(() => void doSearch(val), 260);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused((v) => Math.min(v + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused((v) => Math.max(v - 1, -1)); }
    if (e.key === "Enter" && focused >= 0) handleSelect(results[focused]);
  }

  function handleSelect(result: SearchResult) {
    if (query.trim().length >= 2) setRecents(saveRecent(query.trim()));
    setOpen(false); setInputFocused(false);
    setQuery(""); setResults([]);
    router.push(result.url);
  }

  function handleRecentClick(term: string) {
    setQuery(term);
    setInputFocused(false);
    void doSearch(term);
  }

  function handleRemoveRecent(e: React.MouseEvent, term: string) {
    e.stopPropagation();
    setRecents(removeRecent(term));
  }

  function clearAll() {
    try { localStorage.removeItem(RECENTS_KEY); } catch {}
    setRecents([]);
  }

  function handleClear() { setQuery(""); setResults([]); setOpen(false); }

  const grouped    = results.reduce<Record<string, SearchResult[]>>((acc, r) => { (acc[r.type] ??= []).push(r); return acc; }, {});
  const showRecents = inputFocused && query.length < 2 && recents.length > 0;
  const showResults = open && results.length > 0;
  const showEmpty   = open && !loading && query.length >= 2 && results.length === 0;
  const dropdownOpen = showRecents || showResults || showEmpty;

  return (
    <div ref={ref} className="relative flex-1">
      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 t3" />
        <AnimatePresence>
          {loading && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute end-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-3.5 w-3.5 animate-spin t3" />
            </motion.span>
          )}
        </AnimatePresence>
        {!loading && query && (
          <button onClick={handleClear}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-0.5 t3 transition-colors hover:t2">
            <X className="h-3 w-3" />
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { setInputFocused(true); if (results.length > 0) setOpen(true); }}
          placeholder={`${t("topbar.search")} ⌘K`}
          className="field command-pill ps-9 pe-9 text-sm"
        />
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            key="search-dropdown"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={spring}
            className="absolute inset-x-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl shadow-2xl shadow-black/50"
            style={{
              backgroundColor: "hsl(var(--bg-card))",
              border: "1px solid hsl(var(--border))",
              maxHeight: "72vh",
            }}
          >

            {/* ── Recent searches ────────────────────────────────── */}
            {showRecents && (
              <>
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 t3" />
                    <p className="text-xs font-semibold t2">{t("search.recent") || "آخر البحوثات"}</p>
                  </div>
                  <button onClick={clearAll}
                    className="text-[10px] t3 hover:text-rose-400 transition-colors flex items-center gap-1">
                    <Trash2 className="w-3 h-3" />
                    {t("search.clear_all") || "مسح الكل"}
                  </button>
                </div>
                <div className="pb-2">
                  {recents.map((term, i) => (
                    <motion.button
                      key={term}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ ...spring, delay: i * 0.04 }}
                      onClick={() => handleRecentClick(term)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--bg-input))] transition-colors group text-start"
                    >
                      <div className="p-1.5 rounded-xl bg-[hsl(var(--bg-input))] shrink-0">
                        <Clock className="w-3.5 h-3.5 t3" />
                      </div>
                      <span className="flex-1 text-sm t2 truncate">{term}</span>
                      <button
                        onClick={(e) => handleRemoveRecent(e, term)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                        <X className="w-3 h-3" />
                      </button>
                    </motion.button>
                  ))}
                </div>
                <div className="mx-4 h-px bg-[hsl(var(--border-2))]" />
                <p className="px-4 py-2 text-[10px] t3 text-center">
                  {t("search.hint") || "اكتب للبحث في جميع بياناتك"}
                </p>
              </>
            )}

            {/* ── No results ─────────────────────────────────────── */}
            {showEmpty && (
              <div className="flex flex-col items-center gap-3 py-10 px-4">
                <div className="w-11 h-11 rounded-2xl bg-[hsl(var(--bg-input))] flex items-center justify-center">
                  <Search className="w-5 h-5 t3 opacity-40" />
                </div>
                <p className="text-sm font-semibold t1">{t("search.no_results") || "لا نتائج"}</p>
                <p className="text-xs t3 text-center">
                  {t("search.no_results_sub") || `لم يُعثر على نتائج لـ "${query}"`}
                </p>
              </div>
            )}

            {/* ── Results ────────────────────────────────────────── */}
            {showResults && (
              <>
                {/* Summary bar */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[hsl(var(--border-2))]">
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 t3" />
                    <p className="text-xs t2">
                      <span className="font-bold t1">{results.length}</span>
                      <span className="ms-1 t3">{t("search.results") || "نتيجة"}</span>
                    </p>
                  </div>
                  {/* Type pills */}
                  <div className="flex items-center gap-1">
                    {TYPE_ORDER.filter((type) => grouped[type]?.length).map((type) => {
                      const cfg = TYPE_CFG[type];
                      const Icon = TYPE_ICON[type];
                      return (
                        <div key={type} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg ${cfg.bg}`}>
                          <Icon className={`w-2.5 h-2.5 ${cfg.color}`} />
                          <span className={`text-[9px] font-bold ${cfg.color}`}>{grouped[type].length}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Result rows */}
                <div className="overflow-y-auto" style={{ maxHeight: "calc(72vh - 52px)" }}>
                  {TYPE_ORDER.filter((type) => grouped[type]?.length).map((type) => {
                    const cfg  = TYPE_CFG[type];
                    const Icon = TYPE_ICON[type];
                    return (
                      <div key={type}>
                        {/* Section header */}
                        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2"
                          style={{ backgroundColor: "hsl(var(--bg-card))" }}>
                          <div className={`p-1 rounded-lg ${cfg.bg}`}>
                            <Icon className={`w-3 h-3 ${cfg.color}`} />
                          </div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                            {t(cfg.labelKey)}
                          </p>
                          <span className={`ms-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {grouped[type].length}
                          </span>
                        </div>

                        {/* Items */}
                        {grouped[type].map((result, idx) => {
                          const globalIdx = results.indexOf(result);
                          const isActive  = focused === globalIdx;
                          const amountColor =
                            result.amountType === "income"  ? "text-emerald-400" :
                            result.amountType === "expense" ? "text-rose-400"    : "t2";
                          const amountSign =
                            result.amountType === "income"  ? "+" :
                            result.amountType === "expense" ? "−" : "";

                          return (
                            <motion.button
                              key={`${result.type}-${result.id}`}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ ...spring, delay: idx * 0.025 }}
                              onClick={() => handleSelect(result)}
                              onMouseEnter={() => setFocused(globalIdx)}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors ${
                                isActive ? "bg-[hsl(var(--bg-input))]" : "hover:bg-[hsl(var(--bg-input))]"
                              }`}
                            >
                              {/* Icon */}
                              <div className={`shrink-0 p-2 rounded-xl ${cfg.bg}`}>
                                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                              </div>

                              {/* Text */}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold t1">
                                  {highlightMatch(result.title, query)}
                                </p>
                                <p className="truncate text-[11px] t3 mt-0.5">{result.subtitle}</p>
                              </div>

                              {/* Amount */}
                              {result.amount !== undefined && result.amount > 0 && (
                                <span className={`shrink-0 text-xs font-bold tabular-nums ${amountColor}`}>
                                  {amountSign}{format(result.amount)}
                                </span>
                              )}

                              <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                                isActive ? "t2 opacity-100" : "t3 opacity-0"
                              }`} />
                            </motion.button>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Footer */}
                  <div className="border-t border-[hsl(var(--border-2))] px-4 py-2.5 flex items-center justify-between">
                    <p className="text-[10px] t3">
                      ↑↓ {t("search.navigate") || "للتنقل"} · Enter {t("search.select") || "للفتح"} · Esc {t("search.close") || "للإغلاق"}
                    </p>
                    <p className="text-[10px] t3">⌘K</p>
                  </div>
                </div>
              </>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
