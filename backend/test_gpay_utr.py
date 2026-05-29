#!/usr/bin/env python3
import re
lines = [
    'UPTIransaIcDt5:i6o9n980575557',
    'UPTIransaIcDt1:i1o6n029246756',
    'UPTIransaIcDt6:i3o9n519620217',
]
for l in lines:
    digits = ''.join(re.findall(r'\d+', l))
    print(f'{l} -> all_digits: {digits} -> last12: {digits[-12:] if len(digits)>=12 else "N/A"}')
    # Try: extract digits after the colon
    m = re.search(r'[Ii][Dd]\S*?:?\s*\S*?(\d{12,16})', l)
    if m:
        print(f'  Pattern match: {m.group(1)}')

