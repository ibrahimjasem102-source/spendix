import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, locale = "en-US", currency = "EUR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string, locale = "en-US"): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
