"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useMode } from "@/contexts/ModeContext";
import { MODES, type AppMode } from "@/lib/mode";

export function ModeSwitcher() {
  const { mode, config, setMode } = useMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleSelect(m: AppMode) {
    setOpen(false);
    await setMode(m);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold hover:bg-[hsl(var(--bg-input))] transition-colors"
      >
        <span>{config.emoji}</span>
        <span className={config.color}>{config.label}</span>
        <ChevronDown className={`w-3 h-3 t3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-52 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] shadow-xl overflow-hidden">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 text-start hover:bg-[hsl(var(--bg-input))] transition-colors ${
                mode === m.id ? "bg-[hsl(var(--bg-input))]" : ""
              }`}
            >
              <span className="text-base mt-0.5">{m.emoji}</span>
              <div className="min-w-0">
                <p className={`text-xs font-bold ${mode === m.id ? m.color : "t2"}`}>{m.label}</p>
                <p className="text-[10px] t3 truncate">{m.description}</p>
              </div>
              {mode === m.id && (
                <span className={`ms-auto text-[10px] font-black ${m.color} shrink-0`}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
