"""Dashboard & Insights API routes."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Alert
from app.schemas.schemas import DashboardResponse, AlertOut
from app.services.insights import (
    get_month_summary, get_category_breakdown,
    detect_recurring_subscriptions, generate_ai_insight,
)
from app.services.budget_alerts import check_budgets_and_alert
from app.services.reconciliation import reconcile_all, detect_self_transfers
from app.services.categorization import categorize_all_uncategorized

router = APIRouter(prefix="/api", tags=["dashboard", "insights"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    month: str | None = Query(None, description="YYYY-MM format, defaults to current month"),
    db: AsyncSession = Depends(get_db),
):
    if month:
        try:
            y, m = month.split("-")
            today = date(int(y), int(m), 15)
        except Exception:
            today = date.today()
    else:
        today = date.today()
    current = await get_month_summary(db, today)
    prev_date = today.replace(day=1) - timedelta(days=1)
    previous = await get_month_summary(db, prev_date)

    # Savings trend
    if current.savings_rate > previous.savings_rate + 2:
        trend = "IMPROVING"
    elif current.savings_rate < previous.savings_rate - 2:
        trend = "DECLINING"
    else:
        trend = "STABLE"

    breakdown = await get_category_breakdown(db, today)

    # Recent alerts
    alerts_result = await db.execute(
        select(Alert).order_by(Alert.created_at.desc()).limit(10)
    )
    alerts = [AlertOut.model_validate(a) for a in alerts_result.scalars().all()]

    return DashboardResponse(
        current_month=current,
        previous_month=previous,
        savings_trend=trend,
        category_breakdown=breakdown,
        alerts=alerts,
    )


@router.get("/insights/ai")
async def get_ai_insight(db: AsyncSession = Depends(get_db)):
    insight = await generate_ai_insight(db)
    return {"insight": insight}


@router.get("/insights/subscriptions")
async def get_subscriptions(db: AsyncSession = Depends(get_db)):
    subs = await detect_recurring_subscriptions(db)
    return {"subscriptions": subs, "total_monthly": sum(s["monthly_cost"] for s in subs)}


@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    q = select(Alert).order_by(Alert.created_at.desc())
    if unread_only:
        q = q.where(Alert.is_read.is_(False))
    result = await db.execute(q.limit(50))
    return result.scalars().all()


@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id, db: AsyncSession = Depends(get_db)):
    from uuid import UUID
    alert = await db.get(Alert, UUID(alert_id))
    if alert:
        alert.is_read = True
    return {"ok": True}


@router.post("/pipeline/run")
async def run_full_pipeline(db: AsyncSession = Depends(get_db)):
    """Manually trigger: reconcile → self-transfers → categorize → budget alerts."""
    recon = await reconcile_all(db)
    transfers = await detect_self_transfers(db)
    categorized = await categorize_all_uncategorized(db)
    alerts = await check_budgets_and_alert(db)
    return {
        "reconciliation": recon,
        "self_transfers_detected": transfers,
        "transactions_categorized": categorized,
        "alerts_created": alerts,
    }

