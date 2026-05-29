#!/usr/bin/env python3
"""Test all parsers against actual PDF files."""
import os, sys
sys.path.insert(0, ".")

BASE = "/Users/td4cj4i/Pictures/untitled folder/practice/ledger cum smart finance coach"

tests = [
    ("HDFC", "hdfc-state.pdf", "app.parsers.hdfc_parser", "HDFCBankParser"),
    ("PhonePe", "PhonePe-Statement.pdf", "app.parsers.phonepe_parser", "PhonePeParser"),
    ("GPay", "gpay_statement.pdf", "app.parsers.gpay_parser", "GooglePayParser"),
    ("ICICI", "icici-state.pdf", "app.parsers.icici_parser", "ICICIBankParser"),
]

for label, fname, mod_name, cls_name in tests:
    path = os.path.join(BASE, fname)
    if not os.path.exists(path):
        print(f"\n{label}: FILE NOT FOUND ({fname})")
        continue

    import importlib
    mod = importlib.import_module(mod_name)
    importlib.reload(mod)
    parser = getattr(mod, cls_name)()

    with open(path, "rb") as f:
        data = f.read()

    result = parser.parse(data, fname)
    print(f"\n{'='*50}")
    print(f"  {label}: {result.row_count} transactions, {len(result.errors)} errors")
    print(f"{'='*50}")
    for t in result.transactions[:3]:
        dr = "DR" if t.is_debit else "CR"
        name = t.counterparty_name or t.raw_narration[:50]
        print(f"  {t.txn_date} | {dr} Rs{t.amount} | {name} | UTR={t.utr}")
    if result.transactions:
        print(f"  ... ({result.row_count - 3} more)")
    if result.errors[:3]:
        for e in result.errors[:3]:
            print(f"  ERR: {e[:80]}")

