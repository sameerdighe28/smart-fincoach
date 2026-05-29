"""Base parser interface and common utilities."""
import re
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import BinaryIO

from app.models.models import SourceType


@dataclass
class ParsedTransaction:
    """Intermediate representation from any parser before DB insertion."""
    txn_date: date
    txn_datetime: datetime | None = None
    amount: Decimal = Decimal("0")
    is_debit: bool = True
    balance_after: Decimal | None = None
    raw_narration: str = ""
    bank_ref: str | None = None
    utr: str | None = None
    cheque_no: str | None = None
    counterparty_name: str | None = None
    counterparty_upi_id: str | None = None
    payment_app_note: str | None = None
    source_type: SourceType = SourceType.MANUAL


@dataclass
class ParseResult:
    transactions: list[ParsedTransaction] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    row_count: int = 0
    source_type: SourceType = SourceType.MANUAL


class BaseParser(ABC):
    """All parsers must implement this interface."""

    @abstractmethod
    def parse(self, file_bytes: bytes, filename: str) -> ParseResult:
        ...

    @staticmethod
    def extract_utr(narration: str) -> str | None:
        """Extract 12-digit UTR/RRN from narration string."""
        # UPI UTR patterns: typically 12-digit numeric after keywords
        patterns = [
            r'(?:UTR|RRN|Ref\.?\s*No\.?|UPI[/-])\s*[:/-]?\s*(\d{12,16})',
            r'(\d{12})(?:\s|$|/)',  # standalone 12-digit number
        ]
        for pat in patterns:
            m = re.search(pat, narration, re.IGNORECASE)
            if m:
                return m.group(1).strip()
        return None

    @staticmethod
    def extract_upi_id(narration: str) -> str | None:
        """Extract UPI VPA from narration."""
        m = re.search(r'([a-zA-Z0-9._-]+@[a-zA-Z]{2,})', narration)
        return m.group(1) if m else None

    @staticmethod
    def clean_amount(val: str) -> Decimal:
        """Parse amount string like '1,23,456.78' or '₹ 500' into Decimal."""
        if not val:
            return Decimal("0")
        cleaned = re.sub(r'[₹,\s]', '', str(val).strip())
        try:
            return Decimal(cleaned)
        except InvalidOperation:
            return Decimal("0")

    @staticmethod
    def file_hash(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def parse_indian_date(date_str: str) -> date | None:
        """Parse common Indian date formats."""
        formats = [
            "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
            "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
            "%d %b %Y", "%d %b %y", "%d %B %Y",
            "%Y-%m-%d", "%m/%d/%Y",
        ]
        date_str = date_str.strip()
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

