#!/usr/bin/env python3
import re, io, pdfplumber

TXN_RE = re.compile(
    r'^\s*(\d{1,4})\s+'
    r'(\d{2}[./]\d{2}[./]\d{4})\s+'
    r'([\d,]+\.\d{2})?\s*'
    r'([\d,]+\.\d{2})?\s*'
    r'([\d,]+\.\d{2})?\s*$'
)

with open("../icici-state.pdf", "rb") as f:
    data = f.read()

print(f"File size: {len(data)} bytes")

with pdfplumber.open(io.BytesIO(data)) as pdf:
    print(f"Pages: {len(pdf.pages)}")
    all_lines = []
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            all_lines.extend(text.split("\n"))

    print(f"Total lines: {len(all_lines)}")

    matches = 0
    for i, line in enumerate(all_lines):
        m = TXN_RE.match(line)
        if m:
            matches += 1
            if matches <= 3:
                print(f"  MATCH line {i}: {repr(line[:80])}")
                print(f"    groups: {m.groups()}")
    print(f"Total matches: {matches}")

