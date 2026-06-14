"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Plus, CheckCircle2, Clock, Loader2, DollarSign } from "lucide-react";
import { getAuthToken } from "@/lib/auth/token-store";
import { useCurrency } from "@/lib/currency";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: "active" | "completed" | "paused" | "cancelled";
  hourly_rate?: number;
  budget?: number;
  currency: string;
  start_date?: string;
  end_date?: string;
  color: string;
  contact?: { id: string; name: string } | null;
}

const STATUS_LABELS: Record<Project["status"], { label: string; color: string }> = {
  active:    { label: "نشط",      color: "text-emerald-400 bg-emerald-400/10" },
  completed: { label: "مكتمل",    color: "text-blue-400 bg-blue-400/10" },
  paused:    { label: "متوقف",    color: "text-amber-400 bg-amber-400/10" },
  cancelled: { label: "ملغي",     color: "text-red-400 bg-red-400/10" },
};

function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      return d.data as Project[];
    },
  });
}

function CreateProjectSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name,       setName]       = useState("");
  const [desc,       setDesc]       = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [budget,     setBudget]     = useState("");
  const [loading,    setLoading]    = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    const token = getAuthToken();
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name,
        description:  desc || undefined,
        hourly_rate:  hourlyRate ? parseFloat(hourlyRate) : undefined,
        budget:       budget ? parseFloat(budget) : undefined,
      }),
    });
    setLoading(false);
    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
      style={{ backgroundColor: "rgba(11,15,20,0.80)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 38 }}
        className="w-full sm:max-w-md card rounded-t-[1.75rem] sm:rounded-[1.5rem] p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-black t1">مشروع جديد</p>
          <button onClick={onClose} className="p-1.5 rounded-lg t3 hover:t1 transition-colors text-lg">✕</button>
        </div>
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="اسم المشروع" className="input-field w-full text-sm" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="وصف المشروع (اختياري)" rows={2}
            className="input-field w-full text-sm resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] t3 font-semibold uppercase tracking-wider">سعر الساعة</label>
              <input value={hourlyRate} onChange={e => setHourlyRate(e.target.value)}
                placeholder="0.00" type="number" min="0" className="input-field w-full text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] t3 font-semibold uppercase tracking-wider">الميزانية</label>
              <input value={budget} onChange={e => setBudget(e.target.value)}
                placeholder="0.00" type="number" min="0" className="input-field w-full text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-[hsl(var(--border))] py-3 text-sm font-semibold t2">
            إلغاء
          </button>
          <button onClick={submit} disabled={!name.trim() || loading}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-violet-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            إنشاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ProjectsPage() {
  const { format } = useCurrency();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useProjects();

  const active    = projects.filter(p => p.status === "active");
  const completed = projects.filter(p => p.status === "completed");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black t1">المشاريع</h1>
          <p className="text-xs t3 mt-0.5">{active.length} نشط · {completed.length} مكتمل</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-4 py-2.5 text-sm font-bold text-white">
          <Plus className="w-4 h-4" /> مشروع جديد
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
      ) : projects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-10 h-10 t3 mx-auto mb-3" />
          <p className="text-sm font-bold t1 mb-1">لا توجد مشاريع</p>
          <p className="text-xs t3">أنشئ مشروعك الأول لتتبع أعمالك</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map(project => {
            const st = STATUS_LABELS[project.status];
            return (
              <div key={project.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex-none" style={{ background: project.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold t1 truncate">{project.name}</p>
                      {project.contact && <p className="text-xs t3 truncate">{project.contact.name}</p>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${st.color}`}>
                    {st.label}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs t3 line-clamp-2">{project.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs t3">
                  {project.hourly_rate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(project.hourly_rate)}/ساعة
                    </span>
                  )}
                  {project.budget && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      الميزانية: {format(project.budget)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateProjectSheet
            onClose={() => setShowCreate(false)}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
