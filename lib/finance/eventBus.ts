// Typed pub/sub for cross-module financial events

export type FinancialEventMap = {
  // Cash flow
  "transaction:added":      { id: string; amount: number; direction: "inflow" | "outflow"; category?: string };
  "transaction:updated":    { id: string; amount: number; direction: "inflow" | "outflow" };
  "transaction:deleted":    { id: string };
  // Debts
  "debt:created":           { debtId: string; amount: number; debtType: "payable" | "receivable" };
  "debt:updated":           { debtId: string };
  "debt:deleted":           { debtId: string };
  "debt:payment_recorded":  { debtId: string; amount: number; debtType: "payable" | "receivable" };
  // Investments
  "investment:added":       { id: string; amount: number };
  "investment:updated":     { id: string; previousValue: number; currentValue: number };
  "investment:deleted":     { id: string };
  "investment:profit":      { id: string; gain: number };
  // Work
  "work:session_logged":    { hours: number };
  "work:session_updated":   { id: string };
  "work:session_deleted":   { id: string };
  "work:payment_received":  { amount: number };
  "work:payment_deleted":   { id: string };
  // Goals / Achievements
  "goal:progress_updated":  { goalId: string; progress: number; completed: boolean };
  "achievement:unlocked":   { achievementId: string };
  // Accounts
  "account:created":        { id: string; name: string };
  "account:updated":        { id: string };
  "account:deleted":        { id: string };
  // Subscriptions
  "subscription:created":   { id: string; name: string; amount: number };
  "subscription:updated":   { id: string };
  "subscription:deleted":   { id: string };
  "subscription:charged":   { id: string; name: string; amount: number };
  // Internal signals
  "balance:changed":        { balance: number };
};

type Handler<T> = (payload: T) => void;

class FinancialEventBus {
  private readonly listeners = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof FinancialEventMap>(
    event: K,
    handler: Handler<FinancialEventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof FinancialEventMap>(
    event: K,
    handler: Handler<FinancialEventMap[K]>,
  ): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof FinancialEventMap>(
    event: K,
    payload: FinancialEventMap[K],
  ): void {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }

  clear(): void { this.listeners.clear(); }
}

export const financialBus = new FinancialEventBus();
