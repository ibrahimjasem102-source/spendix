"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight, Briefcase, CalendarClock, Clock, CreditCard, DollarSign,
  FileText, Landmark, Loader2, PieChart, Receipt, RefreshCw, Search, Target,
  Trash2, TrendingUp, UserRound, X,
} from "lucide-react";
import { safeFetch } from "@/lib/fetch-safe";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { spring } from "@/lib/motion";
import type { SearchResult } from "@/app/api/search/route";

const RECENTS_KEY = "spendix_recent_searches";
const MAX_RECENTS = 6;

const TYPE_ICON: Record<SearchResult["type"], React.ElementType> = {
  transaction:  ArrowUpRight,
  debt:         Landmark,
  investment:   TrendingUp,
  work_session: Briefcase,
  work_payment: DollarSign,
  goal:         Target,
  contact:      UserRound,
  subscription: CalendarClock,
  account:      CreditCard,
  budget:       PieChart,
  recurring:    RefreshCw,
};

const TYPE_CFG: Record<SearchResult["type"], { color: string; bg: string; labelKey: string }> = {
  transaction:  { color: "text-cyan-400",    bg: "bg-cyan-400/10",    labelKey: "nav.transactions"     },
  debt:         { color: "text-orange-400",  bg: "bg-orange-400/10",  labelKey: "nav.debts"            },
  investment:   { color: "text-purple-400",  bg: "bg-purple-400/10",  labelKey: "nav.investments"      },
  work_session: { color: "text-emerald-400", bg: "bg-emerald-400/10", labelKey: "nav.work"             },
  work_payment: { color: "text-emerald-400", bg: "bg-emerald-400/10", labelKey: "actions.work_payment" },
  goal:         { color: "text-indigo-400",  bg: "bg-indigo-400/10",  labelKey: "nav.goals"            },
  contact:      { color: "text-rose-400",    bg: "bg-rose-400/10",    labelKey: "search.type_people"   },
  subscription: { color: "text-sky-400",     bg: "bg-sky-400/10",     labelKey: "nav.subscriptions"    },
  account:      { color: "text-violet-400",  bg: "bg-violet-400/10",  labelKey: "nav.accounts"         },
  budget:       { color: "text-amber-400",   bg: "bg-amber-400/10",   labelKey: "nav.budgets"          },
  recurring:    { color: "text-teal-400",    bg: "bg-teal-400/10",    labelKey: "nav.recurring"        },
};

const TYPE_ORDER: SearchResult["type"][] = [
  "transaction", "subscription", "debt", "goal",
  "investment", "account", "contact", "work_session", "work_payment",
  "budget", "recurring",
];

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q     = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lower.indexOf(q, cursor);
  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={idx} className="rounded bg-cyan-400/20 px-0.5 text-cyan-300 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    cursor = idx + query.length;
    idx = lower.indexOf(q, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
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

  const [open,         setOpen]         = useState(false);
  const [query,        setQuery]        = useState("");
  const [results,      setResults]      = useState<SearchResult[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [focused,      setFocused]      = useState(-1);
  const [recents,      setRecents]      = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<SearchResult["type"] | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setRecents(loadRecents()); }, []);

  // ⌘K / Ctrl+K focuses the input
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape" && open) handleClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click outside → close dropdown
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setFocused(-1);
    setActiveFilter(null);
    if (timer.current) clearTimeout(timer.current);
    inputRef.current?.blur();
  }

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    setActiveFilter(null);
    try {
      const res  = await safeFetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data = await res.json() as { results: SearchResult[] };
      setResults(data.results ?? []);
      setFocused(-1);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.length < 2) { setResults([]); return; }
    timer.current = setTimeout(() => void doSearch(val), 260);
  }

  const displayedResults = activeFilter
    ? results.filter((r) => r.type === activeFilter)
    : results;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused((v) => Math.min(v + 1, displayedResults.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused((v) => Math.max(v - 1, -1)); }
    if (e.key === "Enter" && focused >= 0) handleSelect(displayedResults[focused]);
    if (e.key === "Escape") handleClose();
  }

  function handleSelect(result: SearchResult) {
    if (query.trim().length >= 2) setRecents(saveRecent(query.trim()));
    handleClose();
    router.push(result.url);
  }

  function handleRecentClick(term: string) {
    setQuery(term);
    void doSearch(term);
  }

  function handleRemoveRecent(e: React.MouseEvent, term: string) {
    e.stopPropagation();
    setRecents(removeRecent(term));
  }

  function clearAllRecents() {
    try { localStorage.removeItem(RECENTS_KEY); } catch {}
    setRecents([]);
  }

  function toggleFilter(type: SearchResult["type"]) {
    setActiveFilter((prev) => prev === type ? null : type);
    setFocused(-1);
  }

  const grouped      = results.reduce<Record<string, SearchResult[]>>((acc, r) => { (acc[r.type] ??= []).push(r); return acc; }, {});
  const typesPresent = TYPE_ORDER.filter((tp) => grouped[tp]?.length);

  const displayGrouped = displayedResults.reduce<Record<string, SearchResult[]>>(
    (acc, r) => { (acc[r.type] ??= []).push(r); return acc; }, {}
  );
  const displayTypes = TYPE_ORDER.filter((tp) => displayGrouped[tp]?.length);

  const showRecents = query.length < 2 && recents.length > 0;
  const showHint    = query.length < 2 && recents.length === 0;
  const showLoading = query.length >= 2 && loading;
  const showResults = query.length >= 2 && !loading && results.length > 0;
  const showEmpty   = query.length >= 2 && !loading && results.length === 0;

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">

      {/* ── Search input bar ─────────────────────────────── */}
      <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition-all ${
        open
          ? "border-cyan-400/35 bg-[hsl(var(--bg-input))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--bg-input))] hover:border-cyan-400/20"
      }`}>
        {showLoading
          ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin t3" />
          : <Search  className="h-3.5 w-3.5 shrink-0 t3" />
        }

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("topbar.search")}
          className="min-w-0 flex-1 bg-transparent text-sm t1 placeholder:t3 focus:outline-none"
        />

        {query ? (
          <button
            onClick={() => { setQuery(""); setResults([]); setActiveFilter(null); inputRef.current?.focus(); }}
            className="shrink-0 rounded-lg p-0.5 t3 hover:t1 transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd
            className="hidden shrink-0 items-center rounded-lg border border-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] font-semibold t3 sm:flex"
            style={{ backgroundColor: "hsl(var(--bg-card))" }}
          >
            ⌘K
          </kbd>
        )}
      </div>

      {/* ── Dropdown panel ───────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="search-dropdown"
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ ...spring, duration: 0.15 }}
            className="absolute top-full mt-2 inset-x-0 z-[200] overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "hsl(var(--bg-card))",
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset",
              maxHeight: "min(72vh, 520px)",
              overflowY: "auto",
            }}
          >

            {/* ── Hint (no query, no recents) ── */}
            {showHint && (
              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <Search className="w-3.5 h-3.5 t3 shrink-0" />
                <p className="text-xs t3">{t("search.hint")}</p>
                <kbd className="ms-auto text-[10px] t3 border border-[hsl(var(--border))] rounded-md px-1.5 py-0.5 shrink-0"
                  style={{ backgroundColor: "hsl(var(--bg-input))" }}>Esc</kbd>
              </div>
            )}

            {/* ── Recent searches ── */}
            {showRecents && (
              <>
                <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 t3" />
                    <p className="text-xs font-semibold t2">{t("search.recent")}</p>
                  </div>
                  <button
                    onClick={clearAllRecents}
                    className="flex items-center gap-1 text-[10px] t3 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />{t("search.clear_all")}
                  </button>
                </div>
                <div className="pb-1.5">
                  {recents.map((term, i) => (
                    <motion.button
                      key={term}
                      initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ ...spring, delay: i * 0.025 }}
                      onClick={() => handleRecentClick(term)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--bg-input))] transition-colors group text-start"
                    >
                      <div className="p-1.5 rounded-xl bg-[hsl(var(--bg-input))] shrink-0">
                        <Clock className="w-3 h-3 t3" />
                      </div>
                      <span className="flex-1 text-sm t2 truncate">{term}</span>
                      <button
                        onClick={(e) => handleRemoveRecent(e, term)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg t3 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.button>
                  ))}
                </div>
              </>
            )}

            {/* ── Loading ── */}
            {showLoading && (
              <div className="flex items-center justify-center gap-2.5 py-8">
                <Loader2 className="w-4 h-4 t3 animate-spin" />
                <p className="text-sm t3">{t("common.loading")}</p>
              </div>
            )}

            {/* ── Empty state ── */}
            {showEmpty && (
              <div className="flex flex-col items-center gap-2.5 py-9 px-4 text-center">
                <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--bg-input))] flex items-center justify-center">
                  <Search className="w-4 h-4 t3 opacity-40" />
                </div>
                <p className="text-sm font-semibold t1">{t("search.no_results")}</p>
                <p className="text-xs t3">{t("search.no_results_sub")}</p>
              </div>
            )}

            {/* ── Results ── */}
            {showResults && (
              <>
                {/* Filter chips + count */}
                <div
                  className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-[hsl(var(--border-2))] flex-wrap"
                  style={{ backgroundColor: "hsl(var(--bg-card))" }}
                >
                  <p className="text-xs t3 shrink-0">
                    <span className="font-bold t1">{displayedResults.length}</span>
                    {activeFilter && <span className="t3"> / {results.length}</span>}
                    <span className="ms-1">{t("search.results")}</span>
                  </p>
                  <div className="flex items-center gap-1 flex-wrap ms-auto">
                    {typesPresent.map((type) => {
                      const cfg    = TYPE_CFG[type];
                      const Icon   = TYPE_ICON[type];
                      const active = activeFilter === type;
                      return (
                        <button
                          key={type}
                          onClick={() => toggleFilter(type)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-[10px] font-bold ${
                            active
                              ? `${cfg.bg} ring-1 ring-current/30 ${cfg.color}`
                              : `${cfg.bg} ${cfg.color} opacity-55 hover:opacity-100`
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {grouped[type].length}
                          {active && <X className="w-2 h-2 ms-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grouped rows */}
                {displayTypes.map((type) => {
                  const cfg  = TYPE_CFG[type];
                  const Icon = TYPE_ICON[type];
                  return (
                    <div key={type}>
                      {!activeFilter && (
                        <div
                          className="sticky z-[9] flex items-center gap-2 px-3 py-1.5"
                          style={{ backgroundColor: "hsl(var(--bg-card))", top: "41px" }}
                        >
                          <div className={`p-1 rounded-lg ${cfg.bg}`}>
                            <Icon className={`w-3 h-3 ${cfg.color}`} />
                          </div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                            {t(cfg.labelKey as Parameters<typeof t>[0])}
                          </p>
                          <span className={`ms-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {displayGrouped[type].length}
                          </span>
                        </div>
                      )}

                      {displayGrouped[type].map((result, idx) => {
                        const globalIdx   = displayedResults.indexOf(result);
                        const isActive    = focused === globalIdx;
                        const amountColor =
                          result.amountType === "income"  ? "text-emerald-400" :
                          result.amountType === "expense" ? "text-rose-400"    : "t2";
                        const amountSign  =
                          result.amountType === "income"  ? "+" :
                          result.amountType === "expense" ? "−" : "";

                        return (
                          <motion.button
                            key={`${result.type}-${result.id}`}
                            initial={{ opacity: 0, x: -3 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ ...spring, delay: idx * 0.018 }}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setFocused(globalIdx)}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors ${
                              isActive ? "bg-[hsl(var(--bg-input))]" : "hover:bg-[hsl(var(--bg-input))]"
                            }`}
                          >
                            <div className={`shrink-0 p-1.5 rounded-xl ${cfg.bg}`}>
                              <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold t1">
                                {highlightMatch(result.title, query)}
                              </p>
                              {result.noteSnippet ? (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <FileText className="w-2.5 h-2.5 t3 shrink-0" />
                                  <p className="truncate text-[11px] t3 italic">
                                    {highlightMatch(result.noteSnippet, query)}
                                  </p>
                                </div>
                              ) : (
                                <p className="truncate text-[11px] t3 mt-0.5">{result.subtitle}</p>
                              )}
                            </div>
                            {result.amount !== undefined && result.amount > 0 && (
                              <span className={`shrink-0 text-xs font-bold tabular-nums ${amountColor}`}>
                                {amountSign}{format(result.amount)}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Footer keyboard hints */}
                <div className="border-t border-[hsl(var(--border-2))] px-3 py-2 flex items-center justify-between">
                  <p className="text-[10px] t3">↑↓ {t("search.navigate")} · Enter {t("search.select")} · Esc {t("search.close")}</p>
                  <p className="text-[10px] t3">⌘K</p>
                </div>
              </>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
