export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "INCOME" | "EXPENSE";
  budget_limit: number | null;
  exclude_from_reports: boolean;
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

export interface InvestmentDeposit {
  id: number;
  investment_id: number;
  amount: number;
  deposit_date: string;
  created_at: string;
}

export interface InvestmentRedemption {
  id: number;
  investment_id: number;
  amount: number;
  redemption_date: string;
  created_at: string;
}

export interface StockTransaction {
  id: number;
  investment_id: number;
  type: "COMPRA" | "VENDA";
  quantity: number;
  price_per_share: number;
  date: string;
  created_at: string;
}

export interface Investment {
  id: number;
  type: "CRYPTO" | "FII" | "RENDA_FIXA" | "ACAO_BR" | "ACAO_GLOBAL";
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  rate_type: string | null;
  rate_value: number | null;
  maturity_date: string | null;
  created_at: string;
  deposits: InvestmentDeposit[];
  redemptions: InvestmentRedemption[];
  stock_transactions: StockTransaction[];
  current_price: number | null;
  change_24h: number | null;
  total_invested: number | null;
  current_value: number | null;
  profit_loss: number | null;
  profit_loss_pct: number | null;
  realized_profit_loss: number | null;
  unrealized_profit_loss: number | null;
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
  investment_trend: Record<string, { income_in: number; expense_out: number }>;
  equity_trend: { month: string; equity: number }[];
  last_30d_expense_by_category: { name: string; color: string; icon: string; value: number }[];
  total_invested_net_period: number;
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
