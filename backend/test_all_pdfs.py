#!/usr/bin/env python3
"""Inspect PDF structure for all statement files."""
import pdfplumber, io, os

BASE = "/Users/td4cj4i/Pictures/untitled folder/practice/ledger cum smart finance coach"
files = [
    ("HDFC", "hdfc-state.pdf"),
    ("GPAY", "gpay_statement.pdf"),
    ("PHONEPE", "PhonePe-Statement.pdf"),
]

for label, fname in files:
    path = os.path.join(BASE, fname)
    print(f"\n{'='*60}")
    print(f"  {label}: {fname}")
    print(f"{'='*60}")
    with open(path, "rb") as f:
        data = f.read()
    print(f"Size: {len(data)} bytes")
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        print(f"Pages: {len(pdf.pages)}")
        for pi in range(min(2, len(pdf.pages))):
            page = pdf.pages[pi]
            text = page.extract_text() or ""
            lines = text.split("\n")
            print(f"\n--- Page {pi} ({len(lines)} lines) ---")
            for line in lines[:30]:
                print(f"  {repr(line)}")
            tables = page.extract_tables()
            print(f"  Tables: {len(tables)}")
            for ti, table in enumerate(tables):
                print(f"  Table {ti}: {len(table)} rows")
                if table:
                    print(f"    Header: {table[0]}")
                    if len(table) > 1:
                        print(f"    Row 1:  {table[1]}")
                    if len(table) > 2:
                        print(f"    Row 2:  {table[2]}")

