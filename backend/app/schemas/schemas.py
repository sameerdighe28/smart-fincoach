"""Pydantic schemas for API request/response."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.models.models import TransactionType, SourceType, ReconciliationMethod


# ── Transaction ──────────────────────────────────────────────────────────────

class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    txn_date: date
    txn_datetime: datetime | None = None
    amount: Decimal
    is_debit: bool
    balance_after: Decimal | None = None
    source_type: SourceType
    raw_narration: str
    utr: str | None = None
    counterparty_name: str | None = None
    counterparty_upi_id: str | None = None
    payment_app_note: str | None = None
    transaction_type: TransactionType
    category_name: str | None = None
    category_icon: str | None = None
    categorization_source: str | None = None
    reconciliation_method: ReconciliationMethod
    is_self_transfer: bool
    is_recurring: bool
    tags: list[str] | None = None
    notes: str | None = None
    created_at: datetime


class TransactionUpdate(BaseModel):
    category_id: UUID | None = None
    transaction_type: TransactionType | None = None
    notes: str | None = None
    tags: list[str] | None = None
    is_self_transfer: bool | None = None


# ── Category ─────────────────────────────────────────────────────────────────

class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    icon: str
    color: str
    is_system: bool


class CategoryCreate(BaseModel):
    name: str
    icon: str = "💰"
    color: str = "#6366f1"


# ── Budget ───────────────────────────────────────────────────────────────────

class BudgetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    category_id: UUID
    category_name: str | None = None
    month: date
    limit_amount: Decimal
    spent: Decimal | None = None
    remaining: Decimal | None = None
    pct_used: float | None = None
    alert_threshold_pct: int
    is_adaptive: bool


class BudgetCreate(BaseModel):
    category_id: UUID
    month: date
    limit_amount: Decimal
    alert_threshold_pct: int = 80


# ── Upload ───────────────────────────────────────────────────────────────────

class UploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    filename: str
    source_type: SourceType
    row_count: int
    uploaded_at: datetime
    parsed_at: datetime | None = None
    parse_errors: dict | None = None


# ── Alert ────────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    alert_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime


# ── Dashboard / Insights ─────────────────────────────────────────────────────

class CategorySpend(BaseModel):
    category_name: str
    category_icon: str
    total: Decimal
    budget_limit: Decimal | None = None
    pct_of_budget: float | None = None
    txn_count: int


class MonthSummary(BaseModel):
    month: str
    total_income: Decimal
    total_expense: Decimal
    total_transfer: Decimal
    total_investment: Decimal = Decimal("0")
    savings: Decimal
    savings_rate: float  # percentage


class DashboardResponse(BaseModel):
    current_month: MonthSummary
    previous_month: MonthSummary | None = None
    savings_trend: str  # "IMPROVING" | "DECLINING" | "STABLE"
    category_breakdown: list[CategorySpend]
    alerts: list[AlertOut]
    ai_insight: str | None = None

