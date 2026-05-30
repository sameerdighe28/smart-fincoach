"""Nightly analysis cron job script. Run via: python -m app.cron.nightly"""
import asyncio
import sys

from app.core.database import async_session
from app.services.nightly_analysis import run_nightly_analysis


async def main():
    print(f"[Nightly Analysis] Starting...")
    async with async_session() as db:
        try:
            result = await run_nightly_analysis(db)
            await db.commit()
            print(f"[Nightly Analysis] Complete!")
            print(f"  - Critical: {result['critical_count']}")
            print(f"  - Warnings: {result['warning_count']}")
            print(f"  - Info: {result['info_count']}")
            print(f"  - Savings Score: {result['savings_score']['score']}/10")
            if result.get("llm_summary"):
                print(f"  - LLM Summary: {result['llm_summary'][:100]}...")
        except Exception as e:
            await db.rollback()
            print(f"[Nightly Analysis] ERROR: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

