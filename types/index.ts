export type TransactionType        = "income" | "expense";

// ── Households (shared financial groups) ─────────────────────
export type HouseholdRole = "owner" | "admin" | "member";

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
  // joined from auth.users
  email?: string;
}

export interface HouseholdInvitation {
  id: string;
  household_id: string;
  email: string;
  role: Exclude<HouseholdRole, "owner">;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  // joined
  household?: Pick<Household, "id" | "name">;
}

export interface HouseholdSummary {
  member_user_id: string;
  member_email: string;
  monthly_income: number;
  monthly_expenses: number;
  net_balance: number;
  transaction_count: number;
  member_role: HouseholdRole;
  joined_at: string;
}

export interface HouseholdFormData {
  name: string;
}

// ── Tags ──────────────────────────────────────────────────────
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  transaction_count?: number;
}

export interface TagFormData {
  name: string;
  color: string;
}
export type NotificationType       = "info" | "success" | "warning" | "error" | "reminder" | "debt" | "budget" | "work" | "investment" | "ai" | "goal" | "bill";
export type NotificationStatus     = "unread" | "read" | "archived";
export type NotificationPriority   = "low" | "normal" | "high";
export type NotificationSource     = "manual" | "transaction" | "debt" | "debt_payment" | "investment" | "work" | "budget" | "ai" | "system" | "goal" | "bill";

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  source: NotificationSource;
  related_source_id?: string | null;
  action_url?: string | null;
  metadata?: Record<string, unknown>;
  scheduled_for?: string | null;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationData {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  source: NotificationSource;
  priority?: NotificationPriority;
  related_source_id?: string | null;
  action_url?: string | null;
  metadata?: Record<string, unknown>;
  scheduled_for?: string | null;
}
// ── Accounts ──────────────────────────────────────────────────
export type AccountType = "cash" | "bank" | "credit_card" | "wallet" | "savings";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  color?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  balance?: number;
  transaction_count?: number;
}

export interface AccountFormData {
  name: string;
  type: AccountType;
  currency?: string;
  initial_balance: number;
  color?: string | null;
  is_default?: boolean;
}

export type TransactionSource = "manual" | "investment" | "debt" | "debt_payment" | "work" | "work_payment" | "subscription";

// ── Calendar ──────────────────────────────────────────────────
export type CalendarEventType =
  | "income" | "expense"
  | "subscription"
  | "debt_due"
  | "investment"
  | "work_session" | "work_payment";

export interface CalendarEvent {
  id: string;
  date: string;        // YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  amount?: number | null;
  icon?: string | null;
  color: string;
  source: string;      // "bill" | "subscription" | "debt" | "transaction" | "investment" | "work"
  source_id: string;
  action_url: string;
}

// ── Subscriptions ─────────────────────────────────────────────
export type BillingCycle      = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  next_billing_date: string;
  category_id?: string | null;
  account_id?: string | null;
  color?: string | null;
  icon?: string | null;
  notes?: string | null;
  status: SubscriptionStatus;
  remind_days_before: number;
  auto_create_transaction: boolean;
  last_billed_date?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  category?: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  account?: Pick<Account, "id" | "name" | "type"> | null;
  // computed
  days_until_billing?: number;
}

export interface SubscriptionFormData {
  name: string;
  amount: number;
  currency?: string;
  billing_cycle: BillingCycle;
  next_billing_date: string;
  category_id?: string | null;
  account_id?: string | null;
  color?: string | null;
  icon?: string | null;
  notes?: string | null;
  status?: SubscriptionStatus;
  remind_days_before?: number;
  auto_create_transaction?: boolean;
}
export type WorkRecurrence    = "none" | "daily" | "weekly" | "monthly";
export type WorkSessionStatus = "pending" | "paid" | "overdue";
export type InsightType       = "tip" | "warning" | "positive";
export type AssetType         = "stock" | "crypto" | "etf" | "real_estate" | "other";
export type DebtType          = "payable" | "receivable";
export type DebtStatus        = "active" | "partially_paid" | "paid" | "overdue";
export type ContactType       = "person" | "company" | "bank" | "other";

// ── Financial Contacts ────────────────────────────────────────
export interface FinancialContact {
  id: string;
  user_id: string;
  name: string;
  type: ContactType;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactFormData {
  name: string;
  type: ContactType;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface ContactSummary {
  contact: FinancialContact;
  totalPayable: number;
  totalReceivable: number;
  totalPaid: number;
  totalPayablePaid?: number;
  totalReceivablePaid?: number;
  totalRemaining: number;
  totalPayableRemaining?: number;
  totalReceivableRemaining?: number;
  netBalance: number;       // positive = they owe me, negative = I owe them
  direction?: "contact_owes_you" | "you_owe_contact" | "settled";
  health?: "healthy" | "attention_needed" | "high_risk" | "overdue" | "settled";
  healthKey?: string;
  truthKey?: string;
  truthParams?: Record<string, string | number>;
  activeDebts: number;
  paidDebts: number;
  overdueDebts: number;
  totalDebts?: number;
  recoveryRate?: number;
  repaymentRate?: number;
  paymentVelocity?: number;
  averagePaymentDays?: number;
  largestDebt?: number;
  mostRecentDebtDate?: string | null;
  insights?: {
    key: string;
    params?: Record<string, string | number>;
    tone: "positive" | "warning" | "risk" | "neutral";
  }[];
  timeline?: {
    id: string;
    type: "debt_created" | "payment" | "settled" | "overdue";
    date: string;
    amount: number;
    debtId: string;
    debtType: DebtType;
    titleKey: string;
    descriptionKey: string;
    params?: Record<string, string | number>;
  }[];
  lastPaymentDate: string | null;
  debts: Debt[];
}

// ── Categories ────────────────────────────────────────────────
export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string | null;
  section?: "expense" | "income" | "investment" | "debt" | "work" | "general" | null;
  parent_id?: string | null;
  created_at: string;
}

// ── Transactions ──────────────────────────────────────────────
export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  account_id?: string | null;
  title: string;
  notes?: string | null;
  amount: number;
  type: TransactionType;
  source?: TransactionSource;
  related_source_id?: string | null;
  contact_id?: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  category?: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  contact?: Pick<FinancialContact, "id" | "name" | "type"> | null;
  account?: Pick<Account, "id" | "name" | "type"> | null;
  tags?: Pick<Tag, "id" | "name" | "color">[];
}

export interface TransactionFormData {
  title: string;
  notes?: string;
  amount: number;
  type: TransactionType;
  category_id: string | null;
  account_id?: string | null;
  transaction_date: string;
  source?: TransactionSource;
  related_source_id?: string | null;
  contact_id?: string | null;
  tag_ids?: string[];
}

export type BudgetStatus = "safe" | "near_limit" | "over";

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  monthly_limit: number;
  month: number;
  year: number;
  created_at: string;
  category?: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  spent: number;
  remaining: number;
  percent: number;
  status: BudgetStatus;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overBudgetCount: number;
  nearLimitCount: number;
}

export interface BudgetFormData {
  category_id: string;
  monthly_limit: number;
  month: number;
  year: number;
}

// ── Investments ───────────────────────────────────────────────
export interface Investment {
  id: string;
  user_id: string;
  asset_name: string;
  asset_type: AssetType;
  amount_invested: number;
  current_value: number | null;
  investment_date: string;
  notes: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentFormData {
  asset_name: string;
  asset_type: AssetType;
  amount_invested: number;
  current_value?: number | null;
  investment_date: string;
  notes?: string | null;
}

// ── Debts ─────────────────────────────────────────────────────
export interface Debt {
  id: string;
  user_id: string;
  person_or_entity: string;
  debt_type: DebtType;
  total_amount: number;
  paid_amount: number;
  due_date: string | null;
  status: DebtStatus;
  notes: string | null;
  contact_id?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  contact?: Pick<FinancialContact, "id" | "name" | "type" | "phone"> | null;
  remaining_amount?: number;
  health?: "healthy" | "attention_needed" | "high_risk" | "overdue" | "settled";
  progress?: number;
  overdueDays?: number;
  paymentsCount?: number;
  payments?: Pick<DebtPayment, "id" | "amount" | "payment_date" | "notes">[];
}

export interface DebtFormData {
  person_or_entity: string;
  debt_type: DebtType;
  total_amount: number;
  due_date?: string | null;
  notes?: string | null;
  contact_id?: string | null;
}

export interface DebtPayment {
  id: string;
  user_id: string;
  debt_id: string;
  transaction_id: string | null;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface DebtPaymentFormData {
  amount: number;
  payment_date: string;
  notes?: string | null;
}

// ── AI ────────────────────────────────────────────────────────
export interface AIInsight {
  id: string;
  title: string;
  body: string;
  type: InsightType;
}

// ── Dashboard ─────────────────────────────────────────────────
export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
}

// ── Work ──────────────────────────────────────────────────────
export interface WorkSession {
  id: string;
  user_id: string;
  title: string;
  employer_or_client: string;
  hourly_rate: number;
  hours_worked: number;
  expected_amount: number;
  work_date: string;
  due_date?: string | null;
  notes?: string | null;
  recurrence: WorkRecurrence;
  recurrence_end_date?: string | null;
  created_at: string;
  updated_at: string;
  // computed client-side
  status?: WorkSessionStatus;
  paid_amount?: number;
}

export interface WorkSessionFormData {
  title: string;
  employer_or_client: string;
  hourly_rate: number;
  hours_worked: number;
  work_date: string;
  due_date?: string | null;
  notes?: string | null;
  recurrence: WorkRecurrence;
  recurrence_end_date?: string | null;
}

export interface WorkPayment {
  id: string;
  user_id: string;
  work_session_id?: string | null;
  employer_or_client: string;
  amount: number;
  payment_date: string;
  notes?: string | null;
  transaction_id: string | null;
  created_at: string;
}

export interface WorkPaymentFormData {
  employer_or_client: string;
  amount: number;
  payment_date: string;
  notes?: string | null;
  work_session_id?: string | null;
}

// ── Savings ───────────────────────────────────────────────────
export type SavingsCategory = "emergency" | "travel" | "car" | "home" | "education" | "retirement" | "other";
export type SavingsTxType   = "deposit" | "withdraw";

export interface SavingsPot {
  id: string;
  user_id: string;
  name: string;
  category: SavingsCategory;
  target_amount: number | null;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // computed by API
  balance: number;
  progress: number;   // 0-100, only meaningful when target_amount > 0
  tx_count: number;
}

export interface SavingsPotFormData {
  name: string;
  category: SavingsCategory;
  target_amount?: number | null;
  color?: string | null;
  notes?: string | null;
}

export interface SavingsTransaction {
  id: string;
  user_id: string;
  savings_pot_id: string;
  type: SavingsTxType;
  amount: number;
  note: string | null;
  date: string;         // YYYY-MM-DD
  created_at: string;
}

export interface SavingsTxFormData {
  amount: number;
  note?: string | null;
  date?: string;
}

// ── Goals ─────────────────────────────────────────────────────
export type GoalCategory     = "emergency" | "home" | "travel" | "education" | "car" | "retirement" | "other";
export type GoalTrackingType = "manual" | "savings" | "income" | "investment" | "debt_payoff";
export type GoalStatus       = "on_track" | "due_soon" | "overdue" | "completed";

export interface GoalMilestone {
  id: string;
  label: string;
  amount: number;
  reached?: boolean;  // computed: computed_saved >= amount
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  saved_amount: number;          // stored value — used only for 'manual' tracking
  monthly_contribution: number;
  due_date: string | null;
  category: GoalCategory;
  tracking_type: GoalTrackingType;
  linked_debt_id?: string | null;
  start_date: string;
  notes?: string | null;
  color?: string | null;
  milestones?: GoalMilestone[];
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  // computed by API
  computed_saved: number;        // actual progress value (real data or saved_amount)
  progress: number;              // 0-100
  status: GoalStatus;
  remaining: number;
  days_until_due: number | null;
}

export interface GoalFormData {
  title: string;
  target_amount: number;
  saved_amount?: number;
  monthly_contribution?: number;
  due_date?: string | null;
  category: GoalCategory;
  tracking_type: GoalTrackingType;
  linked_debt_id?: string | null;
  start_date?: string;
  notes?: string | null;
  color?: string | null;
  milestones?: GoalMilestone[];
}
