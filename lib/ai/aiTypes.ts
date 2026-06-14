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
  budgets: {
    name: string;
    limit: number;
    spent: number;
    remaining: number;
    percent: number;
    status: "safe" | "near_limit" | "over";
  }[];
  debtPayable: number;
  debtReceivable: number;
  overdueDebts: number;
  activeDebts: number;
  monthlyTrend: { month: string; income: number; expenses: number }[];
  recentTransactions: { title: string; amount: number; type: string; date: string }[];
}

// Extended summary — used by Phase 10 context builder
export interface FinancialSummaryV2 extends FinancialSummary {
  netWorth:      number;
  cashAccounts:  { name: string; balance: number }[];
  investments: {
    totalValue:   number;
    totalInvested: number;
    profitLoss:   number;
    profitLossPct: number;
    count:        number;
    topAsset:     string | null;
  };
  subscriptions: {
    active:        { name: string; amount: number; cycle: string; lastUsed?: string }[];
    totalMonthly:  number;
  };
  goals: {
    name:     string;
    target:   number;
    current:  number;
    progress: number;
    status:   string;
    monthlyNeeded?: number;
  }[];
  debtDetails: {
    name:         string;
    remaining:    number;
    direction:    "payable" | "receivable";
    dueDate:      string | null;
    isOverdue:    boolean;
  }[];
  workDetails: {
    hoursThisMonth: number;
    expected:       number;
    received:       number;
    unpaid:         number;
  };
  health: {
    score:       number;
    savingsRate: number;
    debtRatio:   number;
    label:       string;
  };
  forecastMonthly: {
    projectedIncome:   number;
    projectedExpenses: number;
    projectedNet:      number;
  };
}

// Advisor types
export type AdvisorType = "budget" | "debt" | "goals" | "subscriptions" | "investments" | "health";

export interface AdvisorRequest {
  advisorType: AdvisorType;
  language?: string;
  question?: string;
}

export interface AdvisorResponse {
  advisorType: AdvisorType;
  analysis:    string;
  model:       AIModel;
}

export type ReportPeriod = "weekly" | "monthly" | "quarterly";

export interface ReportRequest {
  period:   ReportPeriod;
  language?: string;
}

export interface ReportResponse {
  period:    ReportPeriod;
  report:    string;
  model:     AIModel;
  generatedAt: string;
}
