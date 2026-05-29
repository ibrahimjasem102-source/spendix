// Typed pub/sub for cross-module financial events

export type FinancialEventMap = {
  "balance:changed":        { balance: number };
  "transaction:added":      { id: string; amount: number; direction: "inflow" | "outflow"; category?: string };
  "transaction:deleted":    { id: string };
  "debt:payment_recorded":  { debtId: string; amount: number; debtType: "payable" | "receivable" };
  "debt:status_changed":    { debtId: string; status: "paid" | "pending" | "overdue" };
  "investment:updated":     { id: string; previousValue: number; currentValue: number };
  "work:session_logged":    { hours: number };
  "work:payment_received":  { amount: number };
  "goal:progress_updated":  { goalId: string; progress: number; completed: boolean };
  "achievement:unlocked":   { achievementId: string };
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
