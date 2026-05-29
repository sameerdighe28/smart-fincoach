"""
Budget alerts & run-rate prediction engine.
- Threshold alerts: "You've used 80% of Food budget"
- Run-rate alerts: "At this pace, you'll exceed Food by ₹2,300"
- Anomaly alerts: "Unusual ₹15,000 spend at X — 5x your average there"
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Transaction, Budget, Category, Alert, TransactionType, SourceType
)
from app.services.reconciliation import BANK_SOURCES


async def check_budgets_and_alert(db: AsyncSession) -> list[dict]:
    """Check all budgets for current month, generate alerts."""
    today = date.today()
    month_start = today.replace(day=1)
    alerts_created = []

    budgets = await db.execute(
        select(Budget, Category)
        .join(Category)
        .where(Budget.month == month_start)
    )

    for budget, category in budgets.all():
        # Sum expenses in this category for current month
        spent_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.category_id == category.id,
                Transaction.is_debit.is_(True),
                Transaction.is_self_transfer.is_(False),
                Transaction.transaction_type == TransactionType.EXPENSE,
                Transaction.txn_date >= month_start,
                Transaction.txn_date <= today,
                Transaction.source_type.in_(BANK_SOURCES),
            )
        )
        spent = Decimal(str(spent_result.scalar()))

        pct_used = float(spent / budget.limit_amount * 100) if budget.limit_amount > 0 else 0

        # Threshold alert
        if pct_used >= budget.alert_threshold_pct:
            alert_msg = f"You've used {pct_used:.0f}% of your {category.name} budget (₹{spent:,.0f} / ₹{budget.limit_amount:,.0f})"
            alert = await _create_alert_if_new(
                db, category.id, "THRESHOLD",
                f"{category.icon} {category.name} budget alert",
                alert_msg
            )
            if alert:
                alerts_created.append({"type": "THRESHOLD", "category": category.name, "pct": pct_used})

        # Run-rate prediction
        days_elapsed = max((today - month_start).days, 1)
        days_in_month = 30  # approximate
        projected = spent / days_elapsed * days_in_month

        if projected > budget.limit_amount:
            overshoot = projected - budget.limit_amount
            alert_msg = (
                f"At this pace, you'll spend ₹{projected:,.0f} on {category.name} this month — "
                f"₹{overshoot:,.0f} over your ₹{budget.limit_amount:,.0f} budget"
            )
            alert = await _create_alert_if_new(
                db, category.id, "RUNRATE",
                f"📈 {category.name} spending projection",
                alert_msg
            )
            if alert:
                alerts_created.append({"type": "RUNRATE", "category": category.name, "projected": float(projected)})

    return alerts_created


async def compute_adaptive_budgets(db: AsyncSession, months_lookback: int = 3) -> list[dict]:
    """
    Compute adaptive budgets based on median spend of last N months.
    Creates budget entries for next month if they don't exist.
    """
    today = date.today()
    next_month = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
    results = []

    categories = (await db.execute(select(Category))).scalars().all()

    for cat in categories:
        monthly_spends = []
        for i in range(1, months_lookback + 1):
            m_start = (today.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            m_end = (m_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

            spent_r = await db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.category_id == cat.id,
                    Transaction.is_debit.is_(True),
                    Transaction.is_self_transfer.is_(False),
                    Transaction.transaction_type == TransactionType.EXPENSE,
                    Transaction.txn_date >= m_start,
                    Transaction.txn_date <= m_end,
                    Transaction.source_type.in_(BANK_SOURCES),
                )
            )
            monthly_spends.append(float(spent_r.scalar()))

        if not any(s > 0 for s in monthly_spends):
            continue

        # Median
        sorted_spends = sorted(monthly_spends)
        mid = len(sorted_spends) // 2
        median = sorted_spends[mid] if len(sorted_spends) % 2 else (sorted_spends[mid - 1] + sorted_spends[mid]) / 2
        # Add 10% buffer
        suggested = Decimal(str(round(median * 1.1, 0)))

        # Check if budget already exists
        existing = await db.execute(
            select(Budget).where(Budget.category_id == cat.id, Budget.month == next_month)
        )
        if not existing.scalar_one_or_none():
            db.add(Budget(
                category_id=cat.id,
                month=next_month,
                limit_amount=suggested,
                is_adaptive=True,
            ))
            results.append({"category": cat.name, "suggested_budget": float(suggested)})

    return results


async def _create_alert_if_new(db: AsyncSession, category_id: UUID, alert_type: str, title: str, message: str) -> Alert | None:
    """Create alert only if same alert doesn't already exist today."""
    today = date.today()
    existing = await db.execute(
        select(Alert).where(
            Alert.category_id == category_id,
            Alert.alert_type == alert_type,
            func.date(Alert.created_at) == today,
        )
    )
    if existing.scalar_one_or_none():
        return None

    alert = Alert(
        category_id=category_id,
        alert_type=alert_type,
        title=title,
        message=message,
    )
    db.add(alert)
    return alert

