"""Category & Budget API routes."""
from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Category, Budget, Transaction, TransactionType
from app.schemas.schemas import (
    CategoryOut, CategoryCreate, BudgetOut, BudgetCreate
)
from app.services.reconciliation import BANK_SOURCES
from app.services.budget_alerts import compute_adaptive_budgets

router = APIRouter(prefix="/api", tags=["categories", "budgets"])


# ── Categories ───────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryOut)
async def create_category(body: CategoryCreate, db: AsyncSession = Depends(get_db)):
    cat = Category(name=body.name, icon=body.icon, color=body.color)
    db.add(cat)
    await db.flush()
    return cat


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: UUID, db: AsyncSession = Depends(get_db)):
    cat = await db.get(Category, cat_id)
    if not cat:
        raise HTTPException(404)
    if cat.is_system:
        raise HTTPException(400, "Cannot delete system category")
    await db.delete(cat)
    return {"ok": True}


# ── Budgets ──────────────────────────────────────────────────────────────────

@router.get("/budgets", response_model=list[BudgetOut])
async def list_budgets(
    month: str | None = Query(None, description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
):
    q = select(Budget, Category).join(Category)
    if month:
        try:
            y, m = month.split("-")
            q = q.where(Budget.month == date(int(y), int(m), 1))
        except Exception:
            pass
    else:
        q = q.where(Budget.month == date.today().replace(day=1))

    results = await db.execute(q)
    out = []
    for budget, cat in results.all():
        # Compute spent
        m_end = (budget.month + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        spent_r = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.category_id == cat.id,
                Transaction.is_debit.is_(True),
                Transaction.is_self_transfer.is_(False),
                Transaction.transaction_type == TransactionType.EXPENSE,
                Transaction.txn_date >= budget.month,
                Transaction.txn_date <= m_end,
                Transaction.source_type.in_(BANK_SOURCES),
            )
        )
        spent = Decimal(str(spent_r.scalar()))
        remaining = budget.limit_amount - spent
        pct = float(spent / budget.limit_amount * 100) if budget.limit_amount > 0 else 0

        out.append(BudgetOut(
            id=budget.id, category_id=cat.id, category_name=cat.name,
            month=budget.month, limit_amount=budget.limit_amount,
            spent=spent, remaining=remaining, pct_used=round(pct, 1),
            alert_threshold_pct=budget.alert_threshold_pct, is_adaptive=budget.is_adaptive,
        ))
    return out


@router.post("/budgets", response_model=BudgetOut)
async def create_budget(body: BudgetCreate, db: AsyncSession = Depends(get_db)):
    budget = Budget(
        category_id=body.category_id,
        month=body.month,
        limit_amount=body.limit_amount,
        alert_threshold_pct=body.alert_threshold_pct,
        is_adaptive=False,
    )
    db.add(budget)
    await db.flush()
    cat = await db.get(Category, body.category_id)
    return BudgetOut(
        id=budget.id, category_id=cat.id, category_name=cat.name,
        month=budget.month, limit_amount=budget.limit_amount,
        spent=Decimal("0"), remaining=budget.limit_amount, pct_used=0,
        alert_threshold_pct=budget.alert_threshold_pct, is_adaptive=False,
    )


@router.post("/budgets/generate-adaptive")
async def generate_adaptive(db: AsyncSession = Depends(get_db)):
    results = await compute_adaptive_budgets(db)
    return {"generated": results}


@router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: UUID, db: AsyncSession = Depends(get_db)):
    b = await db.get(Budget, budget_id)
    if not b:
        raise HTTPException(404)
    await db.delete(b)
    return {"ok": True}


@router.patch("/budgets/{budget_id}")
async def update_budget(budget_id: UUID, body: dict, db: AsyncSession = Depends(get_db)):
    b = await db.get(Budget, budget_id)
    if not b:
        raise HTTPException(404)
    if "limit_amount" in body:
        b.limit_amount = Decimal(str(body["limit_amount"]))
    if "alert_threshold_pct" in body:
        b.alert_threshold_pct = body["alert_threshold_pct"]
    await db.flush()
    return {"ok": True}


