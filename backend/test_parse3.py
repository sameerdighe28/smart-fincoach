#!/usr/bin/env python3
import re, io, pdfplumber
from decimal import Decimal

TXN_LINE_RE = re.compile(
    r'^\s*(\d{1,4})\s+'
    r'(\d{2}[./]\d{2}[./]\d{4})\s+'
    r'([\d,]+\.\d{2})?\s*'
    r'([\d,]+\.\d{2})?\s*'
    r'([\d,]+\.\d{2})?\s*$'
)

with open("../icici-state.pdf", "rb") as f:
    data = f.read()

# Simulate exactly what the class does
all_lines = []
with pdfplumber.open(io.BytesIO(data)) as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            all_lines.extend(text.split("\n"))

print(f"Lines: {len(all_lines)}")

txn_indices = []
for i, line in enumerate(all_lines):
    m = TXN_LINE_RE.match(line)
    if m:
        txn_indices.append((i, m))

print(f"Matched txns: {len(txn_indices)}")

# Now do same but via class
from app.parsers.icici_parser import ICICIBankParser
p = ICICIBankParser()
print(f"Class regex same? {p.TXN_LINE_RE.pattern == TXN_LINE_RE.pattern}")

# Check what happens inside parse
import inspect
src = inspect.getsource(p._parse_pdf)
print(f"_parse_pdf source has 'all_lines': {'all_lines' in src}")
print(f"_parse_pdf source has 'TXN_LINE_RE': {'TXN_LINE_RE' in src}")
print(f"_parse_pdf source has 'extract_tables': {'extract_tables' in src}")

