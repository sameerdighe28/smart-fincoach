#!/usr/bin/env python3
"""Quick test for ICICI parser."""
from app.parsers.icici_parser import ICICIBankParser

with open("../icici-state.pdf", "rb") as f:
    data = f.read()

parser = ICICIBankParser()
result = parser.parse(data, "icici-state.pdf")
print(f"Transactions: {result.row_count}")
print(f"Errors: {len(result.errors)}")
if result.errors:
    for e in result.errors[:5]:
        print(f"  ERR: {e}")
for t in result.transactions[:5]:
    dr = "DR" if t.is_debit else "CR"
    name = t.counterparty_name or t.raw_narration[:60]
    print(f"  {t.txn_date} | {dr} Rs{t.amount} | {name} | UTR={t.utr}")

