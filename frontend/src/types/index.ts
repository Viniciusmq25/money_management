export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "INCOME" | "EXPENSE";
  budget_limit: number | null;
}

export interface Transaction {
  id: number;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: string;
  category_id: number | null;
  category: Category | null;
  source: "MANUAL" | "IMPORT";
  fit_id: string | null;
  created_at: string;
}

export interface Investment {
  id: number;
  type: "CRYPTO" | "FII" | "RENDA_FIXA" | "ACAO_BR" | "ACAO_GLOBAL";
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  purchase_date: string | null;
  rate_type: string | null;
  rate_value: number | null;
  maturity_date: string | null;
  original_amount: number | null;
  created_at: string;
  current_price: number | null;
  change_24h: number | null;
  total_invested: number | null;
  current_value: number | null;
  profit_loss: number | null;
  profit_loss_pct: number | null;
}

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  color: string;
  progress: number | null;
  created_at: string;
}

export interface ImportPreview {
  filename: string;
  bank: string | null;
  date_start: string | null;
  date_end: string | null;
  transactions: ImportTransaction[];
  total_income: number;
  total_expense: number;
  duplicates_count: number;
}

export interface ImportTransaction {
  date: string;
  amount: number;
  description: string;
  type: "INCOME" | "EXPENSE";
  fit_id: string | null;
  suggested_category: string | null;
  is_duplicate: boolean;
}

export interface DashboardData {
  current_balance: number;
  monthly_result: number;
  total_income: number;
  total_expense: number;
  total_invested: number;
  total_current_value: number;
  investment_change_pct: number;
  monthly_trend: { month: string; income: number; expense: number }[];
  expense_by_category: { name: string; color: string; icon: string; value: number }[];
  recent_transactions: Transaction[];
  market_data: {
    crypto?: Record<string, { price: number; change_24h: number }>;
    fii?: Record<string, { price: number; change_24h: number }>;
    rates?: { selic_annual: number; cdi_annual: number };
  };
}

export interface InvestmentSummary {
  total_invested: number;
  total_current_value: number;
  profit_loss: number;
  profit_loss_pct: number;
  by_type: Record<string, { invested: number; current: number; count: number }>;
  positions: Investment[];
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantContext {
  configured: boolean;
  model: string;
  suggested_prompts: string[];
  snapshot: {
    generated_at: string;
    current_balance: number;
    monthly_income: number;
    monthly_expense: number;
    monthly_result: number;
    average_monthly_income: number;
    average_monthly_expense: number;
    average_monthly_result: number;
    goals_total_target: number;
    goals_total_current: number;
    goals_total_gap: number;
    goals: Array<{
      name: string;
      target_amount: number;
      current_amount: number;
      remaining_amount: number;
      progress: number;
      deadline: string | null;
    }>;
    top_expense_categories: Array<{
      name: string;
      total: number;
      color: string;
    }>;
    recent_transactions: Array<{
      description: string;
      type: "INCOME" | "EXPENSE";
      amount: number;
      date: string;
      category: string | null;
    }>;
    investments: {
      total_invested: number;
      total_current_value: number;
      investment_change_pct: number;
      positions_count: number;
    };
    purchase_scenario: null | {
      amount: number;
      description: string | null;
      balance_after_purchase: number;
      monthly_result_after_purchase: number;
      purchase_vs_balance_pct: number | null;
      purchase_vs_income_pct: number | null;
    };
  };
}

export interface AssistantChatResponse {
  reply: string;
  model: string;
  snapshot: AssistantContext["snapshot"];
}
