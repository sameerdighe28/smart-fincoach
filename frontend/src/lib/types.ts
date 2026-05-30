// API types matching backend schemas

export type SourceType = "ICICI_BANK" | "HDFC_BANK" | "PHONEPE" | "GOOGLEPAY" | "CRED" | "IMOBILE" | "MANUAL";
export type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER" | "REFUND" | "INVESTMENT";
export type ReconciliationMethod = "UTR_EXACT" | "AMOUNT_DATE_FUZZY" | "MANUAL" | "UNMATCHED";

export interface Transaction {
  id: string;
  txn_date: string;
  txn_datetime: string | null;
  amount: number;
  is_debit: boolean;
  balance_after: number | null;
  source_type: SourceType;
  raw_narration: string;
  utr: string | null;
  counterparty_name: string | null;
  counterparty_upi_id: string | null;
  payment_app_note: string | null;
  transaction_type: TransactionType;
  category_name: string | null;
  category_icon: string | null;
  categorization_source: string | null;
  reconciliation_method: ReconciliationMethod;
  is_self_transfer: boolean;
  is_recurring: boolean;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
}

export interface Budget {
  id: string;
  category_id: string;
  category_name: string | null;
  month: string;
  limit_amount: number;
  spent: number | null;
  remaining: number | null;
  pct_used: number | null;
  alert_threshold_pct: number;
  is_adaptive: boolean;
}

export interface Upload {
  id: string;
  filename: string;
  source_type: SourceType;
  row_count: number;
  uploaded_at: string;
  parsed_at: string | null;
  parse_errors: Record<string, unknown> | null;
}

export interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CategorySpend {
  category_name: string;
  category_icon: string;
  total: number;
  budget_limit: number | null;
  pct_of_budget: number | null;
  txn_count: number;
}

export interface MonthSummary {
  month: string;
  total_income: number;
  total_expense: number;
  total_transfer: number;
  total_investment: number;
  savings: number;
  savings_rate: number;
}

export interface DashboardResponse {
  current_month: MonthSummary;
  previous_month: MonthSummary | null;
  savings_trend: "IMPROVING" | "DECLINING" | "STABLE";
  category_breakdown: CategorySpend[];
  alerts: Alert[];
  ai_insight: string | null;
}

