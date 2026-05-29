#!/usr/bin/env python3
"""Debug: try categorizing a few uncategorized transactions with verbose output."""
import asyncio
from app.core.database import async_session
from app.models.models import Transaction, Category, CategoryRule
from app.services.categorization import categorize_by_rules, categorize_transaction
from sqlalchemy import select, func, or_

async def debug():
    async with async_session() as db:
        # Count
        r = await db.execute(select(func.count(Transaction.id)).where(Transaction.category_id.is_(None)))
        print(f"Uncategorized: {r.scalar()}")

        r = await db.execute(select(func.count(Transaction.id)).where(Transaction.category_id.isnot(None)))
        print(f"Categorized: {r.scalar()}")

        # Get 5 uncategorized
        r = await db.execute(
            select(Transaction).where(
                Transaction.category_id.is_(None),
                or_(
                    Transaction.categorization_source.is_(None),
                    Transaction.categorization_source != "MANUAL",
                ),
            ).limit(5)
        )
        txns = r.scalars().all()
        print(f"\nFound {len(txns)} to process")

        for t in txns:
            print(f"\n--- TXN: {t.raw_narration[:60]} ---")
            print(f"  counterparty: {t.counterparty_name}")
            print(f"  source_type: {t.source_type}")

            # Try rules
            cat_id = await categorize_by_rules(t, db)
            print(f"  Rule match: {cat_id}")

            # Try full categorization
            try:
                await categorize_transaction(t, db)
                if t.category_id:
                    cat = await db.get(Category, t.category_id)
                    print(f"  Result: {cat.name} (via {t.categorization_source})")
                else:
                    print(f"  Result: STILL UNCATEGORIZED")
            except Exception as e:
                print(f"  ERROR: {e}")

        await db.commit()

asyncio.run(debug())

