"""ICICI Bank statement parser — supports PDF (text-based) and Excel/CSV formats."""
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


class ICICIBankParser(BaseParser):
    SOURCE = SourceType.ICICI_BANK

    COL_MAP = {
        "date": ["date", "transaction date", "txn date", "value date", "s no."],
        "narration": ["narration", "particulars", "description", "transaction remarks", "remarks"],
        "debit": ["withdrawal amt (inr)", "debit", "withdrawal", "debit amount", "withdrawal amount"],
        "credit": ["deposit amt (inr)", "credit", "deposit", "credit amount", "deposit amount"],
        "balance": ["closing balance (inr)", "balance", "running balance", "balance (inr)"],
        "cheque": ["chq./ref.no.", "cheque no", "cheque", "ref no", "chq no"],
    }

    # Regex: SNo  DD.MM.YYYY  [amount1]  [amount2]  [amount3]
    TXN_LINE_RE = re.compile(
        r'^\s*(\d{1,4})\s+'
        r'(\d{2}[./]\d{2}[./]\d{4})\s+'
        r'([\d,]+\.\d{2})?\s*'
        r'([\d,]+\.\d{2})?\s*'
        r'([\d,]+\.\d{2})?\s*$'
    )

    def parse(self, file_bytes: bytes, filename: str) -> ParseResult:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext == "pdf":
            return self._parse_pdf(file_bytes)
        elif ext in ("xlsx", "xls"):
            return self._parse_excel(file_bytes)
        elif ext == "csv":
            return self._parse_csv(file_bytes)
        else:
            return ParseResult(errors=[f"Unsupported file type: {ext}"], source_type=self.SOURCE)

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

        # Pass 1: Find all transaction lines (SNo + date + amounts)
        txn_indices = []
        for i, line in enumerate(all_lines):
            m = self.TXN_LINE_RE.match(line)
            if m:
                txn_indices.append((i, m))

        # Pass 2: For each txn, collect narration from surrounding lines
        for idx, (line_i, match) in enumerate(txn_indices):
            try:
                date_str = match.group(2)
                amt1 = match.group(3)
                amt2 = match.group(4)
                amt3 = match.group(5)

                txn_date = self.parse_indian_date(date_str)
                if not txn_date:
                    continue

                # Determine withdrawal/deposit/balance from amounts
                if amt3:
                    withdrawal = self.clean_amount(amt1) if amt1 else Decimal("0")
                    deposit = self.clean_amount(amt2) if amt2 else Decimal("0")
                    balance = self.clean_amount(amt3)
                elif amt2:
                    v1 = self.clean_amount(amt1)
                    v2 = self.clean_amount(amt2)
                    withdrawal = v1
                    deposit = Decimal("0")
                    balance = v2
                elif amt1:
                    continue
                else:
                    continue

                # Collect narration from lines above (between prev txn and this)
                prev_line_i = txn_indices[idx - 1][0] if idx > 0 else -1
                narration_parts = []
                for j in range(prev_line_i + 1, line_i):
                    l = all_lines[j].strip()
                    if not self._is_header_or_noise(l):
                        narration_parts.append(l)

                # Continuation lines below
                next_line_i = txn_indices[idx + 1][0] if idx + 1 < len(txn_indices) else len(all_lines)
                for j in range(line_i + 1, next_line_i):
                    l = all_lines[j].strip()
                    if not self._is_header_or_noise(l):
                        narration_parts.append(l)

                narration = " ".join(narration_parts).strip()

                # Detect deposits: salary, IMPS credits, refunds, etc.
                credit_keywords = ["salary", "neft cr", "credit", "refund", "cashback",
                                   "reversal", "mmt/imps", "int.pb", "inb transfer"]
                is_deposit = any(kw in narration.lower() for kw in credit_keywords)

                if is_deposit and not amt3:
                    deposit = self.clean_amount(amt1)
                    withdrawal = Decimal("0")
                    balance = self.clean_amount(amt2)

                is_debit = withdrawal > 0
                amount = withdrawal if is_debit else deposit
                if amount == 0:
                    continue

                utr = self.extract_utr(narration)
                upi_id = self.extract_upi_id(narration)

                counterparty = None
                upi_match = re.match(r'UPI/([^/]+)/', narration)
                if upi_match:
                    counterparty = upi_match.group(1).strip()

                txn = ParsedTransaction(
                    txn_date=txn_date,
                    amount=amount,
                    is_debit=is_debit,
                    balance_after=balance if balance > 0 else None,
                    raw_narration=narration,
                    utr=utr,
                    counterparty_name=counterparty,
                    counterparty_upi_id=upi_id,
                    source_type=self.SOURCE,
                )
                result.transactions.append(txn)
            except Exception as e:
                result.errors.append(f"Line {line_i} parse error: {e}")

        result.row_count = len(result.transactions)
        return result

    def _is_header_or_noise(self, line: str) -> bool:
        line_l = line.lower().strip()
        if not line_l:
            return True
        if re.match(r'^\d{1,3}$', line_l):
            return True
        noise = [
            "transaction withdrawal deposit balance",
            "s no.", "cheque number", "transaction remarks",
            "date amount (inr)", "amount (inr)",
            "statement of transactions",
            "your base branch",
        ]
        return any(n in line_l for n in noise)

    def _parse_excel(self, file_bytes: bytes) -> ParseResult:
        df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
        return self._parse_dataframe(df)

    def _parse_csv(self, file_bytes: bytes) -> ParseResult:
        for skip in range(0, 11):
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), skiprows=skip)
                cols_lower = [str(c).lower() for c in df.columns]
                if any("date" in c for c in cols_lower):
                    return self._parse_dataframe(df)
            except Exception:
                continue
        return ParseResult(errors=["Could not find header row in CSV"], source_type=self.SOURCE)

    def _parse_dataframe(self, df: pd.DataFrame) -> ParseResult:
        result = ParseResult(source_type=self.SOURCE)
        df.columns = [str(c).strip() for c in df.columns]
        col_idx = self._resolve_columns(df.columns.tolist())
        if not col_idx.get("date"):
            result.errors.append(f"Could not identify date column. Found: {df.columns.tolist()}")
            return result

        for _, row in df.iterrows():
            try:
                date_val = str(row[col_idx["date"]]).strip()
                txn_date = self.parse_indian_date(date_val)
                if not txn_date:
                    continue

                narration = str(row.get(col_idx.get("narration", ""), "")).strip()
                debit_str = str(row.get(col_idx.get("debit", ""), "")).strip()
                credit_str = str(row.get(col_idx.get("credit", ""), "")).strip()
                balance_str = str(row.get(col_idx.get("balance", ""), "")).strip()

                debit_amt = self.clean_amount(debit_str) if debit_str not in ("", "nan", "0") else Decimal("0")
                credit_amt = self.clean_amount(credit_str) if credit_str not in ("", "nan", "0") else Decimal("0")

                is_debit = debit_amt > 0
                amount = debit_amt if is_debit else credit_amt
                if amount == 0:
                    continue

                balance = self.clean_amount(balance_str) if balance_str not in ("", "nan") else None
                utr = self.extract_utr(narration)
                upi_id = self.extract_upi_id(narration)

                counterparty = None
                upi_m = re.match(r'UPI/([^/]+)/', narration)
                if upi_m:
                    counterparty = upi_m.group(1).strip()

                result.transactions.append(ParsedTransaction(
                    txn_date=txn_date, amount=amount, is_debit=is_debit,
                    balance_after=balance, raw_narration=narration,
                    utr=utr, counterparty_name=counterparty,
                    counterparty_upi_id=upi_id, source_type=self.SOURCE,
                ))
            except Exception as e:
                result.errors.append(f"Row error: {e}")

        result.row_count = len(result.transactions)
        return result

    def _resolve_columns(self, columns: list[str]) -> dict[str, str]:
        result = {}
        cols_lower = {c: c.lower().strip() for c in columns}
        for key, variants in self.COL_MAP.items():
            for col, col_l in cols_lower.items():
                if any(v in col_l for v in variants):
                    result[key] = col
                    break
        return result

