#!/usr/bin/env python3
import pdfplumber, io, re

BASE = "/Users/td4cj4i/Pictures/untitled folder/practice/ledger cum smart finance coach"
with open(f"{BASE}/gpay_statement.pdf", "rb") as f:
    data = f.read()

with pdfplumber.open(io.BytesIO(data)) as pdf:
    text = pdf.pages[0].extract_text()
    lines = text.split("\n")
    for i, l in enumerate(lines[5:20], 5):
        has_trans = bool(re.search(r'[Tt]rans', l))
        digits = ''.join(re.findall(r'\d+', l))
        print(f"L{i:3d}: trans={has_trans} digits={digits:>20s} | {l[:70]}")

