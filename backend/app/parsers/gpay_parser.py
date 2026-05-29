"""Google Pay transaction history parser — PDF, CSV, Excel.

Note: Google Pay PDFs have garbled/overlapping text due to their PDF generation.
This parser uses heuristic regex patterns to extract data from the mangled text.
"""
import re
import io
from decimal import Decimal
from datetime import datetime

import pandas as pd

from app.parsers.base import BaseParser, ParseResult, ParsedTransaction
from app.models.models import SourceType

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


class GooglePayParser(BaseParser):
    SOURCE = SourceType.GOOGLEPAY

    COL_MAP = {
        "date": ["date", "transaction date", "time", "timestamp", "created on"],
        "amount": ["amount", "total", "transaction amount"],
        "type": ["type", "transaction type", "status", "debit/credit"],
        "merchant": ["to", "from", "name", "merchant", "paid to", "receiver", "sender"],
        "utr": ["utr", "rrn", "reference id", "transaction id", "ref no"],
        "note": ["note", "description", "remarks", "message"],
    }

    # GPay PDF has mangled text like:
    # '29Nov2,025 PaitdoJayeGsh ₹2,500'
    # '22Dec2,025 PaitdoZEPTO ₹169'
    # '28Mar2,026 Receifvreodsmuraj ₹550'
    # UPI Transaction ID on next line: 'UPTIransaIcDt5:i6o9n980575557'
    # Bank info: 'PaibdyICIBCaIn3k603' or 'PaibdyHDFBCan5k694'

    # Date pattern: DDMon,YYYY (garbled with merged chars)
    GPAY_DATE_RE = re.compile(
        r'^(\d{2})([A-Z][a-z]{2})(\d),\s*(\d{3})\s+'  # e.g. "29Nov2,025 " -> 29 Nov 2025
    )

    # Amount at end: ₹amount
    GPAY_AMOUNT_RE = re.compile(r'₹([\d,]+\.?\d*)\s*$')

    # UTR on detail line: garbled "UPTIransaIcDt(i)(o)(n)DIGITS"
    GPAY_UTR_RE = re.compile(r'(?:UPI\s*)?[Tt]rans\w*[Ii][Dd]\w*:?\s*i?o?n?\s*(\d{9,16})')
    # Simpler: just find a line with a long digit sequence after transaction-like text
    GPAY_UTR_FALLBACK = re.compile(r'[Tt]rans.*?(\d{12,16})')

    # Bank line: PaibdyICIBCaIn3k603 -> Paid by ICICI Bank XX3603
    GPAY_BANK_RE = re.compile(r'Pa[ib][db][yy](ICIB?C[aA]In|HDFB?C[aA]n).*?(\d{3,4})\s*$')

    def parse(self, file_bytes: bytes, filename: str) -> ParseResult:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext == "pdf":
            return self._parse_pdf(file_bytes)
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
            return self._parse_df(df) if df is not None else ParseResult(errors=["Failed"], source_type=self.SOURCE)
        elif ext == "csv":
            df = self._read_csv(file_bytes)
            return self._parse_df(df) if df is not None else ParseResult(errors=["Failed"], source_type=self.SOURCE)
        return ParseResult(errors=[f"Unsupported: {ext}"], source_type=self.SOURCE)

    def _parse_pdf(self, file_bytes: bytes) -> ParseResult:
        if pdfplumber is None:
            return ParseResult(errors=["pdfplumber not installed"], source_type=self.SOURCE)

        result = ParseResult(source_type=self.SOURCE)

        all_lines = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    all_lines.extend(text.split("\n"))

        i = 0
        while i < len(all_lines):
            line = all_lines[i].strip()

            # Try to match a GPay transaction line (date + merchant + amount)
            date_m = self.GPAY_DATE_RE.match(line)
            amount_m = self.GPAY_AMOUNT_RE.search(line)

            if not date_m or not amount_m:
                i += 1
                continue

            # Parse date: "29Nov2,025" -> day=29, mon=Nov, year=2025
            day = date_m.group(1)
            mon = date_m.group(2)
            # Year is split: group(3)=first digit, group(4)=last 3 digits
            year = date_m.group(3) + date_m.group(4)

            try:
                txn_date = datetime.strptime(f"{day} {mon} {year}", "%d %b %Y").date()
            except ValueError:
                i += 1
                continue

            amount = self.clean_amount(amount_m.group(1))
            if amount == 0:
                i += 1
                continue

            # Extract merchant name from middle (between date and amount)
            middle = line[date_m.end():amount_m.start()].strip()

            # Detect direction: "Paitdo" = Paid to (debit), "Receifvreod/Receifvromsm" = Received from (credit)
            is_debit = True
            merchant = middle
            if re.match(r'Pa[iy]?[td]+o', middle, re.IGNORECASE):
                is_debit = True
                merchant = re.sub(r'^Pa[iy]?[td]+o\s*', '', middle).strip()
            elif re.match(r'Rece[iy]?[fv]+[re]*[od]*[ms]*', middle, re.IGNORECASE):
                is_debit = False
                merchant = re.sub(r'^Rece[iy]?[fv]+[re]*[od]*[ms]*\s*', '', middle).strip()

            # Clean up garbled merchant name (remove random case issues)
            # Try to make it readable
            merchant = self._clean_gpay_merchant(merchant)

            # Collect detail lines (UTR, bank info)
            utr = None
            bank_hint = None
            j = i + 1
            while j < len(all_lines) and j <= i + 3:
                detail = all_lines[j].strip()
                # Check for next transaction
                if self.GPAY_DATE_RE.match(detail) and self.GPAY_AMOUNT_RE.search(detail):
                    break

                # Extract UTR — GPay garbles "UPI Transaction ID: 123456789012"
                # into "UPTIransaIcDt1:i2o3n456789012", so extract all digits
                if not utr and re.search(r'rans', detail, re.IGNORECASE):
                    all_digits = ''.join(re.findall(r'\d+', detail))
                    if len(all_digits) >= 12:
                        utr = all_digits[-12:]

                # Extract bank
                bank_m = self.GPAY_BANK_RE.search(detail)
                if bank_m:
                    bank_hint = detail

                j += 1

            narration = f"{'Paid to' if is_debit else 'Received from'} {merchant}"

            result.transactions.append(ParsedTransaction(
                txn_date=txn_date,
                amount=amount,
                is_debit=is_debit,
                raw_narration=narration,
                utr=utr,
                counterparty_name=merchant if merchant else None,
                payment_app_note=narration,
                source_type=self.SOURCE,
            ))

            i = j

        result.row_count = len(result.transactions)
        return result

    def _clean_gpay_merchant(self, name):
        """Attempt to clean garbled GPay merchant names."""
        if not name:
            return name
        # Insert spaces before uppercase letters that follow lowercase
        cleaned = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
        # Remove obvious garble patterns
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def _read_csv(self, data):
        for skip in range(0, 11):
            try:
                df = pd.read_csv(io.BytesIO(data), skiprows=skip)
                if any("date" in str(c).lower() or "amount" in str(c).lower() for c in df.columns):
                    return df
            except Exception:
                continue
        return None

    def _parse_df(self, df):
        result = ParseResult(source_type=self.SOURCE)
        df.columns = [str(c).strip() for c in df.columns]
        cols = self._resolve(df.columns.tolist())

        for _, row in df.iterrows():
            try:
                date_str = str(row.get(cols.get("date", ""), "")).strip()
                txn_date = self.parse_indian_date(date_str.split(" ")[0] if date_str else "")
                if not txn_date:
                    continue
                amount = self.clean_amount(str(row.get(cols.get("amount", ""), "0")))
                if amount == 0:
                    continue
                txn_type = str(row.get(cols.get("type", ""), "")).lower()
                is_debit = "debit" in txn_type or "paid" in txn_type or "sent" in txn_type
                if not txn_type:
                    is_debit = True
                merchant = str(row.get(cols.get("merchant", ""), "")).strip()
                utr = str(row.get(cols.get("utr", ""), "")).strip()
                note = str(row.get(cols.get("note", ""), "")).strip()
                result.transactions.append(ParsedTransaction(
                    txn_date=txn_date, amount=amount, is_debit=is_debit,
                    raw_narration=f"{merchant} | {note}".strip(" |"),
                    utr=utr if utr not in ("", "nan") else None,
                    counterparty_name=merchant if merchant not in ("", "nan") else None,
                    payment_app_note=note if note not in ("", "nan") else None,
                    source_type=self.SOURCE,
                ))
            except Exception as e:
                result.errors.append(str(e))

        result.row_count = len(result.transactions)
        return result

    def _resolve(self, columns):
        result = {}
        for key, variants in self.COL_MAP.items():
            for col in columns:
                if any(v in col.lower() for v in variants):
                    result[key] = col
                    break
        return result

