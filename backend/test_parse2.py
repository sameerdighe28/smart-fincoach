#!/usr/bin/env python3
import sys
sys.path.insert(0, ".")

# Force reimport
import importlib
import app.parsers.icici_parser as mod
importlib.reload(mod)

parser = mod.ICICIBankParser()

with open("../icici-state.pdf", "rb") as f:
    data = f.read()

# Call _parse_pdf directly
result = parser._parse_pdf(data)
print(f"Transactions: {result.row_count}")
print(f"Errors: {len(result.errors)}")
for t in result.transactions[:3]:
    dr = "DR" if t.is_debit else "CR"
    print(f"  {t.txn_date} | {dr} Rs{t.amount} | {t.counterparty_name or t.raw_narration[:50]}")

