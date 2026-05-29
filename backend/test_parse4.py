#!/usr/bin/env python3
import traceback
from app.parsers.icici_parser import ICICIBankParser

with open("../icici-state.pdf", "rb") as f:
    data = f.read()

p = ICICIBankParser()
try:
    result = p._parse_pdf(data)
    print(f"Result: {result.row_count} txns, {len(result.errors)} errors")
except Exception as e:
    traceback.print_exc()

# Now manually step through the method
import io, pdfplumber
all_lines = []
with pdfplumber.open(io.BytesIO(data)) as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            all_lines.extend(text.split("\n"))

txn_indices = []
for i, line in enumerate(all_lines):
    m = p.TXN_LINE_RE.match(line)
    if m:
        txn_indices.append((i, m))

print(f"Manual scan: {len(txn_indices)} txns found")

# Try processing first txn
idx = 0
line_i, match = txn_indices[0]
print(f"First txn line {line_i}: {all_lines[line_i]!r}")
print(f"  Groups: {match.groups()}")

date_str = match.group(2)
print(f"  Date str: {date_str}")
txn_date = p.parse_indian_date(date_str)
print(f"  Parsed date: {txn_date}")

