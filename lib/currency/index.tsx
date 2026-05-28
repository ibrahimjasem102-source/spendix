"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

export type Currency = "EUR" | "USD" | "GBP" | "CHF" | "JPY";

export const CURRENCIES: { code: Currency; labelKey: string; symbol: string }[] = [
  { code: "EUR", labelKey: "currency.eur", symbol: "EUR" },
  { code: "USD", labelKey: "currency.usd", symbol: "$" },
  { code: "GBP", labelKey: "currency.gbp", symbol: "GBP" },
  { code: "CHF", labelKey: "currency.chf", symbol: "CHF" },
  { code: "JPY", labelKey: "currency.jpy", symbol: "JPY" },
];

const RATES: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  CHF: 0.97,
  JPY: 162.5,
};

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  format: (amount: number) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "EUR",
  setCurrency: () => {},
  format: (amount) => `EUR ${amount.toFixed(2)}`,
  symbol: "EUR",
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useTranslation();
  const [currency, setCurrencyState] = useState<Currency>("EUR");

  useEffect(() => {
    const stored = localStorage.getItem("spendix_currency") as Currency;
    if (stored && RATES[stored]) setCurrencyState(stored);
  }, []);

  const setCurrency = useCallback((nextCurrency: Currency) => {
    setCurrencyState(nextCurrency);
    localStorage.setItem("spendix_currency", nextCurrency);
  }, []);

  const format = useCallback(
    (amountEUR: number) => {
      const converted = amountEUR * RATES[currency];
      const localeTag = locale === "ar" ? "ar" : locale === "de" ? "de-DE" : "en-US";

      return new Intl.NumberFormat(localeTag, {
        style: "currency",
        currency,
        minimumFractionDigits: currency === "JPY" ? 0 : 2,
        maximumFractionDigits: currency === "JPY" ? 0 : 2,
      }).format(converted);
    },
    [currency, locale]
  );

  const symbol = CURRENCIES.find((item) => item.code === currency)?.symbol ?? "EUR";

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
