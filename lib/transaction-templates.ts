"use client";

import type { TransactionFormData } from "@/types";

const STORAGE_KEY = "spendix_tx_templates";
const MAX_TEMPLATES = 10;

export interface TransactionTemplate {
  id: string;
  name: string;          // display name (auto-generated from title)
  data: Omit<TransactionFormData, "transaction_date">;
  usedCount: number;
  createdAt: string;
}

function load(): TransactionTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(templates: TransactionTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function getTemplates(): TransactionTemplate[] {
  return load().sort((a, b) => b.usedCount - a.usedCount);
}

export function saveTemplate(data: Omit<TransactionFormData, "transaction_date">): TransactionTemplate {
  const templates = load();
  const existing  = templates.findIndex((t) => t.data.title.trim() === data.title.trim() && t.data.type === data.type);

  if (existing >= 0) {
    // Update existing
    templates[existing].data      = data;
    templates[existing].usedCount += 1;
    save(templates);
    return templates[existing];
  }

  const newTemplate: TransactionTemplate = {
    id:        crypto.randomUUID(),
    name:      data.title.trim(),
    data,
    usedCount: 1,
    createdAt: new Date().toISOString(),
  };

  // Keep only the most recent MAX_TEMPLATES
  const updated = [newTemplate, ...templates].slice(0, MAX_TEMPLATES);
  save(updated);
  return newTemplate;
}

export function useTemplate(id: string): TransactionTemplate | null {
  const templates = load();
  const tmpl = templates.find((t) => t.id === id);
  if (!tmpl) return null;

  // Increment usage count
  tmpl.usedCount += 1;
  save(templates.map((t) => (t.id === id ? tmpl : t)));
  return tmpl;
}

export function deleteTemplate(id: string): void {
  save(load().filter((t) => t.id !== id));
}

export function clearTemplates(): void {
  localStorage.removeItem(STORAGE_KEY);
}
