"""Financial Planning API routes — India-specific tax planning, FY views, health metrics."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.financial_planning import (
    get_fy_summary, get_tax_planning, get_debt_to_income,
    get_emergency_fund_health, get_fixed_vs_variable,
)

router = APIRouter(prefix="/api/finance", tags=["financial-planning"])


@router.get("/fy-summary")
async def fy_summary(
    fy_year: int | None = Query(None, description="FY start year, e.g. 2025 for FY 2025-26"),
    db: AsyncSession = Depends(get_db),
):
    """Financial Year (April-March) summary."""
    return await get_fy_summary(db, fy_year)


@router.get("/tax-planning")
async def tax_planning(
    fy_year: int | None = Query(None, description="FY start year"),
    db: AsyncSession = Depends(get_db),
):
    """80C and 80D tax deduction tracker."""
    return await get_tax_planning(db, fy_year)


@router.get("/debt-to-income")
async def debt_to_income(db: AsyncSession = Depends(get_db)):
    """Debt-to-income ratio and health assessment."""
    return await get_debt_to_income(db)


@router.get("/emergency-fund")
async def emergency_fund(db: AsyncSession = Depends(get_db)):
    """Emergency fund adequacy check."""
    return await get_emergency_fund_health(db)


@router.get("/fixed-vs-variable")
async def fixed_vs_variable(
    month: str | None = Query(None, description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
):
    """Fixed vs variable expense breakdown."""
    from datetime import date
    month_date = None
    if month:
        try:
            y, m = month.split("-")
            month_date = date(int(y), int(m), 15)
        except Exception:
            pass
    return await get_fixed_vs_variable(db, month_date)


@router.get("/health-score")
async def financial_health_score(db: AsyncSession = Depends(get_db)):
    """Overall financial health score combining all metrics."""
    dti = await get_debt_to_income(db)
    emergency = await get_emergency_fund_health(db)
    fy = await get_fy_summary(db)

    # Score calculation (out of 100)
    score = 0

    # Savings rate (max 30 points)
    sr = fy.get("savings_rate", 0)
    if sr >= 30: score += 30
    elif sr >= 20: score += 25
    elif sr >= 10: score += 15
    elif sr > 0: score += 10

    # Debt-to-income (max 25 points)
    dti_r = dti.get("dti_ratio", 0)
    if dti_r == 0: score += 25
    elif dti_r < 20: score += 20
    elif dti_r < 35: score += 15
    elif dti_r < 50: score += 5

    # Emergency fund (max 25 points)
    ef_months = emergency.get("months_covered", 0)
    if ef_months >= 6: score += 25
    elif ef_months >= 3: score += 15
    elif ef_months >= 1: score += 5

    # Investment discipline (max 20 points)
    inv_rate = (fy.get("total_investment", 0) / fy.get("total_income", 1) * 100) if fy.get("total_income", 0) > 0 else 0
    if inv_rate >= 20: score += 20
    elif inv_rate >= 10: score += 15
    elif inv_rate >= 5: score += 10
    elif inv_rate > 0: score += 5

    # Grade
    if score >= 80: grade = "A"
    elif score >= 65: grade = "B"
    elif score >= 50: grade = "C"
    elif score >= 35: grade = "D"
    else: grade = "F"

    return {
        "score": score,
        "grade": grade,
        "breakdown": {
            "savings_rate": {"score": min(30, score), "max": 30, "value": f"{sr}%"},
            "debt_management": {"score": min(25, max(0, score - 30)), "max": 25, "value": f"{dti_r}% DTI"},
            "emergency_fund": {"score": min(25, max(0, score - 55)), "max": 25, "value": f"{ef_months:.1f} months"},
            "investment_discipline": {"score": min(20, max(0, score - 80)), "max": 20, "value": f"{inv_rate:.0f}%"},
        },
        "quick_summary": {
            "savings_rate": fy.get("savings_rate", 0),
            "dti_ratio": dti.get("dti_ratio", 0),
            "emergency_months": emergency.get("months_covered", 0),
            "investment_rate": round(inv_rate, 1),
        },
    }

