export type TriggerType =
  | "on_transaction"
  | "on_salary"
  | "on_budget_exceeded"
  | "on_balance_low"
  | "on_debt_paid"
  | "on_goal_reached"
  | "schedule";

export type ActionType =
  | "notify"
  | "allocate_to_goal"
  | "create_transaction"
  | "send_webhook";

// ── Trigger configs ────────────────────────────────────────────

export interface OnTransactionTrigger {
  type:       "on_transaction";
  category?:  string;
  minAmount?: number;
  direction?: "inflow" | "outflow";
}

export interface OnBalanceLowTrigger {
  type:      "on_balance_low";
  threshold: number;
  currency?: string;
}

export interface OnBudgetExceededTrigger {
  type:       "on_budget_exceeded";
  categoryId?: string;
  threshold?: number; // 0-1, e.g. 0.8 = 80% used
}

export interface OnSalaryTrigger {
  type:   "on_salary";
  source?: string;
}

export interface ScheduleTrigger {
  type:      "schedule";
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 0=Sun…6=Sat
  dayOfMonth?: number;
}

export type TriggerConfig =
  | OnTransactionTrigger
  | OnBalanceLowTrigger
  | OnBudgetExceededTrigger
  | OnSalaryTrigger
  | ScheduleTrigger;

// ── Action configs ────────────────────────────────────────────

export interface NotifyAction {
  type:    "notify";
  title:   string;
  message: string;
  severity?: "info" | "warning" | "alert";
}

export interface AllocateToGoalAction {
  type:       "allocate_to_goal";
  goalId:     string;
  amount?:    number;    // fixed amount
  percentage?: number;  // percentage of trigger amount (0-100)
  note?:      string;
}

export interface CreateTransactionAction {
  type:        "create_transaction";
  title:       string;
  amount:      number;
  direction:   "inflow" | "outflow";
  categoryId?: string;
  accountId?:  string;
}

export interface SendWebhookAction {
  type:    "send_webhook";
  url:     string;
  method?: "POST" | "GET";
}

export type ActionConfig =
  | NotifyAction
  | AllocateToGoalAction
  | CreateTransactionAction
  | SendWebhookAction;

// ── Rule ──────────────────────────────────────────────────────

export interface AutomationRule {
  id:              string;
  user_id:         string;
  name:            string;
  description?:    string;
  is_active:       boolean;
  trigger_type:    TriggerType;
  trigger_config:  TriggerConfig;
  action_type:     ActionType;
  action_config:   ActionConfig;
  last_triggered_at?: string;
  trigger_count:   number;
  created_at:      string;
}

// ── Engine event ──────────────────────────────────────────────

export interface TriggerEvent {
  type:   TriggerType;
  userId: string;
  data:   Record<string, unknown>;
}
