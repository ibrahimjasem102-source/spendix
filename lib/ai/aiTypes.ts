export type AIModel = "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" | "mock";

export type InsightCategory =
  | "savings" | "spending" | "debt" | "investment" | "income" | "cashflow" | "risk" | "goal";

export type InsightSeverity = "critical" | "warning" | "positive" | "info";

export type InsightStatus = "new" | "read" | "dismissed" | "acted";

export interface AIInsightRecord {
  id: string;
  user_id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  body: string;
  action?: string | null;
  action_url?: string | null;
  confidence: number;
  status: InsightStatus;
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateInsightsRequest {
  language?: string;
  forceRefresh?: boolean;
}

export interface GenerateInsightsResponse {
  insights: AIInsightRecord[];
  generated: boolean;
  cached: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  language?: string;
}

export interface ChatResponse {
  reply: string;
  model: AIModel;
}

export interface FinancialSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  dailyBurn: number;
  workIncome: number;
  transactionCount: number;
  topCategories: { name: string; amount: number }[];
  debtPayable: number;
  debtReceivable: number;
  overdueDebts: number;
  activeDebts: number;
  monthlyTrend: { month: string; income: number; expenses: number }[];
  recentTransactions: { title: string; amount: number; type: string; date: string }[];
}
