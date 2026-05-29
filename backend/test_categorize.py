#!/usr/bin/env python3
import asyncio
from app.core.database import async_session
from app.models.models import Transaction, Category, CategoryRule
from app.services.categorization import categorize_transaction, categorize_by_rules
from sqlalchemy import select, func


async def check():
    async with async_session() as db:
        r = await db.execute(select(func.count(Transaction.id)))
        print(f"Total transactions: {r.scalar()}")

        r = await db.execute(select(func.count(Transaction.id)).where(Transaction.category_id.isnot(None)))
        print(f"Categorized: {r.scalar()}")

        r = await db.execute(select(func.count(Category.id)))
        print(f"Categories: {r.scalar()}")

        r = await db.execute(select(func.count(CategoryRule.id)))
        print(f"Rules: {r.scalar()}")

        # List some rules
        rules = await db.execute(select(CategoryRule).limit(5))
        for rule in rules.scalars().all():
            cat = await db.get(Category, rule.category_id)
            print(f"  Rule: pattern='{rule.pattern[:40]}' -> {cat.name if cat else '?'}")

        # Sample uncategorized
        r = await db.execute(select(Transaction).where(Transaction.category_id.is_(None)).limit(3))
        txns = r.scalars().all()
        for t in txns:
            print(f"\nUncategorized txn: {t.raw_narration[:80]}")
            # Try rule match manually
            cat_id = await categorize_by_rules(t, db)
            print(f"  Rule match result: {cat_id}")

        # Try categorizing one manually
        if txns:
            t = txns[0]
            print(f"\nTrying full categorize on: {t.raw_narration[:60]}")
            await categorize_transaction(t, db)
            print(f"  Result: category_id={t.category_id}, source={t.categorization_source}")
            await db.commit()


asyncio.run(check())

