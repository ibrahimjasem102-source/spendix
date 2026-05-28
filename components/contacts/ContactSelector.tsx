"use client";

import { useState, useEffect, useRef } from "react";
import { Search, User, Building2, Landmark, HelpCircle, Plus, X, ChevronDown } from "lucide-react";
import { FinancialContact, ContactType, ContactFormData } from "@/types";
import { safeFetch } from "@/lib/fetch-safe";
import { useTranslation } from "@/lib/i18n";

const TYPE_ICONS: Record<ContactType, React.ElementType> = {
  person:  User,
  company: Building2,
  bank:    Landmark,
  other:   HelpCircle,
};

const TYPE_COLORS: Record<ContactType, string> = {
  person:  "text-cyan-400 bg-cyan-400/10",
  company: "text-purple-400 bg-purple-400/10",
  bank:    "text-emerald-400 bg-emerald-400/10",
  other:   "text-gray-400 bg-gray-400/10",
};

interface Props {
  value: string | null;           // contact_id
  onChange: (id: string | null, name: string) => void;
  contacts: FinancialContact[];
  onContactCreated?: (c: FinancialContact) => void;
}

export default function ContactSelector({ value, onChange, contacts, onContactCreated }: Props) {
  const { t } = useTranslation();
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ContactType>("person");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = contacts.find((c) => c.id === value) ?? null;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await safeFetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), type: newType } as ContactFormData),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || payload.errorKey || t("contacts.fetch_error"));
      const { contact } = payload;
      if (!contact?.id) throw new Error(t("contacts.fetch_error"));
      onContactCreated?.(contact);
      onChange(contact.id, contact.name);
      setCreating(false);
      setNewName("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("contacts.fetch_error"));
    } finally {
      setSaving(false);
    }
  }

  const CONTACT_TYPES: ContactType[] = ["person", "company", "bank", "other"];

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium t2 mb-1.5">
        {t("contacts.select")} <span className="t3 font-normal">({t("debts.notes_optional")})</span>
      </label>

      {/* Trigger */}
      <button type="button" onClick={() => setOpen(!open)}
        className="field flex items-center justify-between text-start w-full">
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1 rounded shrink-0 ${TYPE_COLORS[selected.type]}`}>
              {(() => { const Icon = TYPE_ICONS[selected.type]; return <Icon className="w-3 h-3" />; })()}
            </div>
            <span className="text-sm t1 truncate">{selected.name}</span>
          </div>
        ) : (
          <span className="text-sm t3">{t("contacts.select_or_create")}</span>
        )}
        <div className="flex items-center gap-1 shrink-0 ms-2">
          {selected && (
            <span onClick={(e) => { e.stopPropagation(); onChange(null, ""); }}
              className="p-0.5 rounded hover:bg-[hsl(var(--bg-input))] t3 hover:t1 cursor-pointer">
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 t3 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 inset-x-0 z-50 modal-card shadow-2xl rounded-xl overflow-hidden">
          {/* Search */}
          {!creating && (
            <div className="p-2 border-b border-[hsl(var(--border-2))]">
              <div className="relative">
                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t3" />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("contacts.name_placeholder")}
                  className="field ps-8 py-2 text-xs" autoFocus />
              </div>
            </div>
          )}

          {/* List */}
          {!creating && (
            <div className="max-h-44 overflow-y-auto">
              {filtered.length === 0 && query && (
                <p className="text-xs t3 text-center py-3">{t("common.no_data")}</p>
              )}
              {filtered.map((c) => {
                const Icon = TYPE_ICONS[c.type];
                return (
                  <button key={c.id} type="button"
                    onClick={() => { onChange(c.id, c.name); setOpen(false); setQuery(""); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-start hover:bg-[hsl(var(--bg-input))] transition-colors">
                    <div className={`p-1.5 rounded-lg shrink-0 ${TYPE_COLORS[c.type]}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium t1 truncate">{c.name}</p>
                      <p className="text-[10px] t3">{t(`contacts.types.${c.type}`)}</p>
                    </div>
                  </button>
                );
              })}

              {/* Create new */}
              <button type="button" onClick={() => { setCreating(true); setNewName(query); setQuery(""); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-cyan-400 hover:bg-cyan-400/5 transition-colors border-t border-[hsl(var(--border-2))]">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t("contacts.create_new")}</span>
              </button>
            </div>
          )}

          {/* Inline create form */}
          {creating && (
            <div className="p-3 space-y-3">
              <p className="text-xs font-semibold t1">{t("contacts.add")}</p>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder={t("contacts.name_placeholder")}
                className="field text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
                autoFocus />
              <div className="grid grid-cols-4 gap-1">
                {CONTACT_TYPES.map((tp) => {
                  const Icon = TYPE_ICONS[tp];
                  return (
                    <button key={tp} type="button" onClick={() => setNewType(tp)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-medium transition-all ${
                        newType === tp ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/30" : "border-[hsl(var(--border-2))] t3 hover:t2"
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {t(`contacts.types.${tp}`)}
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-xs text-rose-400 bg-rose-400/10 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setCreating(false)}
                  className="flex-1 py-2 text-xs t2 border border-[hsl(var(--border))] rounded-xl hover:t1 transition-all">
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={handleCreate} disabled={!newName.trim() || saving}
                  className="flex-1 py-2 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#0B0F17] rounded-xl disabled:opacity-50 transition-all">
                  {saving ? "..." : t("common.add")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
