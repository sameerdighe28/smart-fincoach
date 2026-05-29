#!/usr/bin/env python3
"""Quick check on the 6 uncategorized."""
import asyncio
from app.core.database import async_session
from app.models.models import Transaction
from sqlalchemy import select, func

async def check():
    async with async_session() as db:
        r = await db.execute(
            select(Transaction).where(Transaction.category_id.is_(None)).limit(10)
        )
        for t in r.scalars().all():
            print(f"is_self_transfer={t.is_self_transfer} | is_debit={t.is_debit} | src={t.source_type} | narr={t.raw_narration[:60]}")

asyncio.run(check())

