"""Transaction API routes."""
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.models.models import Transaction, Category, TransactionType, SourceType
from app.schemas.schemas import TransactionOut, TransactionUpdate
from app.services.categorization import override_category
from app.services.reconciliation import BANK_SOURCES

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("/", response_model=list[TransactionOut])
async def list_transactions(
    source: SourceType | None = None,
    category_id: UUID | None = None,
    txn_type: TransactionType | None = None,
    month: str | None = Query(None, description="YYYY-MM"),
    is_unmatched: bool | None = None,
    is_self_transfer: bool | None = None,
    search: str | None = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    q = select(Transaction).options(joinedload(Transaction.category)).order_by(Transaction.txn_date.desc())

    if source:
        q = q.where(Transaction.source_type == source)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if txn_type:
        q = q.where(Transaction.transaction_type == txn_type)
    if month:
        try:
            y, m = month.split("-")
            m_start = date(int(y), int(m), 1)
            if int(m) == 12:
                m_end = date(int(y) + 1, 1, 1)
            else:
                m_end = date(int(y), int(m) + 1, 1)
            q = q.where(Transaction.txn_date >= m_start, Transaction.txn_date < m_end)
        except Exception:
            pass
    if is_unmatched is True:
        q = q.where(Transaction.reconciled_with_id.is_(None))
    if is_self_transfer is not None:
        q = q.where(Transaction.is_self_transfer == is_self_transfer)
    if search:
        q = q.where(
            Transaction.raw_narration.ilike(f"%{search}%") |
            Transaction.counterparty_name.ilike(f"%{search}%")
        )

    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    txns = result.unique().scalars().all()

    return [
        TransactionOut(
            id=t.id, txn_date=t.txn_date, txn_datetime=t.txn_datetime,
            amount=t.amount, is_debit=t.is_debit, balance_after=t.balance_after,
            source_type=t.source_type, raw_narration=t.raw_narration, utr=t.utr,
            counterparty_name=t.counterparty_name, counterparty_upi_id=t.counterparty_upi_id,
            payment_app_note=t.payment_app_note, transaction_type=t.transaction_type,
            category_name=t.category.name if t.category else None,
            category_icon=t.category.icon if t.category else None,
            categorization_source=t.categorization_source,
            reconciliation_method=t.reconciliation_method,
            is_self_transfer=t.is_self_transfer, is_recurring=t.is_recurring,
            tags=t.tags, notes=t.notes, created_at=t.created_at,
        )
        for t in txns
    ]


@router.patch("/{txn_id}", response_model=TransactionOut)
async def update_transaction(
    txn_id: UUID,
    body: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
):
    txn = await db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")

    if body.category_id:
        await override_category(txn_id, body.category_id, db)
    if body.transaction_type:
        txn.transaction_type = body.transaction_type
    if body.notes is not None:
        txn.notes = body.notes
    if body.tags is not None:
        txn.tags = body.tags
    if body.is_self_transfer is not None:
        txn.is_self_transfer = body.is_self_transfer

    await db.flush()
    await db.refresh(txn)

    cat = await db.get(Category, txn.category_id) if txn.category_id else None
    return TransactionOut(
        id=txn.id, txn_date=txn.txn_date, txn_datetime=txn.txn_datetime,
        amount=txn.amount, is_debit=txn.is_debit, balance_after=txn.balance_after,
        source_type=txn.source_type, raw_narration=txn.raw_narration, utr=txn.utr,
        counterparty_name=txn.counterparty_name, counterparty_upi_id=txn.counterparty_upi_id,
        payment_app_note=txn.payment_app_note, transaction_type=txn.transaction_type,
        category_name=cat.name if cat else None, category_icon=cat.icon if cat else None,
        categorization_source=txn.categorization_source,
        reconciliation_method=txn.reconciliation_method,
        is_self_transfer=txn.is_self_transfer, is_recurring=txn.is_recurring,
        tags=txn.tags, notes=txn.notes, created_at=txn.created_at,
    )

