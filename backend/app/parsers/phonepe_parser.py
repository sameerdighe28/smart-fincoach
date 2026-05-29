"""PhonePe transaction history parser — PDF, CSV, Excel."""
import re
import io
from decimal import Decimal

import pandas as pd

from app.parsers.base import BaseParser, ParseResult, ParsedTransaction
from app.models.models import SourceType

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


class PhonePeParser(BaseParser):
    SOURCE = SourceType.PHONEPE

    COL_MAP = {
        "date": ["date", "transaction date", "created on", "timestamp"],
        "amount": ["amount", "total amount", "transaction amount"],
        "type": ["type", "transaction type", "status"],
        "merchant": ["merchant", "paid to", "receiver", "to", "name"],
        "utr": ["utr", "rrn", "reference id", "ref no", "transaction id"],
        "note": ["note", "message", "description", "remarks"],
        "upi_id": ["upi id", "vpa", "upi"],
    }

    # PhonePe PDF patterns:
    # "Feb 14, 2026 Paid to Amale Prakash Chandrakant Debit INR 15.00"
    # "Feb 19, 2026 Received from Monika subhash dighe Credit INR 2500.00"
    # "Feb 19, 2026 Bill paid - FASTag Debit INR 603.00"
    TXN_LINE_RE = re.compile(
        r'^([A-Z][a-z]{2}\s+\d{1,2},\s*\d{4})\s+'   # Date: "Feb 14, 2026"
        r'(Paid to|Received from|Bill paid\s*[-–])\s*'  # Type
        r'(.+?)\s+'                                     # Name/merchant
        r'(Debit|Credit)\s+'                            # Debit/Credit
        r'INR\s+([\d,]+\.?\d*)\s*$'                     # Amount
    )

    def parse(self, file_bytes: bytes, filename: str) -> ParseResult:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext == "pdf":
            return self._parse_pdf(file_bytes)
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
            return self._parse_df(df) if df is not None else ParseResult(errors=["Failed to read"], source_type=self.SOURCE)
        elif ext == "csv":
            df = self._read_csv(file_bytes)
            return self._parse_df(df) if df is not None else ParseResult(errors=["Failed to read"], source_type=self.SOURCE)
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

        # Find transaction lines and their detail lines
        i = 0
        while i < len(all_lines):
            line = all_lines[i].strip()
            m = self.TXN_LINE_RE.match(line)
            if not m:
                i += 1
                continue

            date_str = m.group(1)      # "Feb 14, 2026"
            txn_action = m.group(2)    # "Paid to" / "Received from" / "Bill paid -"
            name = m.group(3).strip()  # Merchant/person name
            direction = m.group(4)     # "Debit" / "Credit"
            amount_str = m.group(5)    # "15.00"

            # Parse date
            txn_date = self._parse_phonepe_date(date_str)
            if not txn_date:
                i += 1
                continue

            amount = self.clean_amount(amount_str)
            if amount == 0:
                i += 1
                continue

            is_debit = direction == "Debit"

            # Collect detail lines below (time, Transaction ID, UTR, Debited from)
            utr = None
            txn_id = None
            account_hint = None
            detail_parts = []

            j = i + 1
            while j < len(all_lines) and j <= i + 5:
                detail = all_lines[j].strip()
                if self.TXN_LINE_RE.match(detail):
                    break  # Next transaction

                # Extract UTR
                utr_m = re.search(r'UTR\s*(?:No\s*)?:?\s*(\d{9,16})', detail)
                if utr_m:
                    utr = utr_m.group(1)

                # Extract Transaction ID
                tid_m = re.search(r'Transaction\s*ID\s*:?\s*(\S+)', detail)
                if tid_m:
                    txn_id = tid_m.group(1)

                # Extract account hint
                acc_m = re.search(r'(?:Debited from|Credited to)\s+(\S+)', detail)
                if acc_m:
                    account_hint = acc_m.group(1)

                detail_parts.append(detail)
                j += 1

            narration = f"{txn_action} {name}"
            if detail_parts:
                narration += " | " + " | ".join(detail_parts)

            result.transactions.append(ParsedTransaction(
                txn_date=txn_date,
                amount=amount,
                is_debit=is_debit,
                raw_narration=narration,
                utr=utr,
                counterparty_name=name,
                payment_app_note=f"{txn_action} {name}",
                source_type=self.SOURCE,
            ))

            i = j

        result.row_count = len(result.transactions)
        return result

    def _parse_phonepe_date(self, date_str):
        """Parse 'Feb 14, 2026' format."""
        from datetime import datetime
        formats = ["%b %d, %Y", "%B %d, %Y", "%b %d,%Y"]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        return None

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

        if not cols.get("date") and not cols.get("amount"):
            result.errors.append(f"Missing columns. Found: {df.columns.tolist()}")
            return result

        for _, row in df.iterrows():
            try:
                date_str = str(row.get(cols.get("date", ""), "")).strip()
                txn_date = self.parse_indian_date(date_str.split(" ")[0]) or self._parse_phonepe_date(date_str)
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

