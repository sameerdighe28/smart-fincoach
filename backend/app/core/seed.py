"""Seed default categories and rules."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Category, CategoryRule

DEFAULT_CATEGORIES = [
    ("Food & Dining", "🍔", "#ef4444"),
    ("Groceries", "🛒", "#f97316"),
    ("Transport", "🚗", "#eab308"),
    ("Fuel", "⛽", "#84cc16"),
    ("Shopping", "🛍️", "#22c55e"),
    ("Entertainment", "🎬", "#14b8a6"),
    ("Health & Medical", "🏥", "#06b6d4"),
    ("Education", "📚", "#3b82f6"),
    ("Bills & Utilities", "💡", "#6366f1"),
    ("Rent", "🏠", "#8b5cf6"),
    ("Subscriptions", "📱", "#a855f7"),
    ("Insurance", "🛡️", "#d946ef"),
    ("Investments", "📈", "#ec4899"),
    ("Salary", "💰", "#10b981"),
    ("Freelance", "💻", "#059669"),
    ("Cashback & Rewards", "🎁", "#f59e0b"),
    ("Refund", "↩️", "#6b7280"),
    ("Transfer", "🔄", "#9ca3af"),
    ("Cash Withdrawal", "🏧", "#78716c"),
    ("EMI & Loans", "🏦", "#dc2626"),
    ("Personal Care", "💅", "#f472b6"),
    ("Travel", "✈️", "#0ea5e9"),
    ("Gifts & Donations", "🎗️", "#c084fc"),
    ("Other", "📦", "#71717a"),
]

# Regex rules for common Indian merchants/narrations
DEFAULT_RULES = [
    # Food
    (r"swiggy|zomato|dominos|pizza|mcdonald|burger\s*king|kfc|restaurant|cafe|dhaba|biryani|food", "Food & Dining", 100),
    (r"bigbasket|blinkit|zepto|dmart|more\s*supermarket|reliance\s*fresh|grocery|supermarket|vegetables|fruits", "Groceries", 100),
    # Transport
    (r"uber|ola|rapido|metro\s*rail|irctc|railways|redbus|bus\s*ticket|parking|toll", "Transport", 90),
    (r"petrol|diesel|hp\s*pay|indian\s*oil|bharat\s*petroleum|fuel\s*station|shell", "Fuel", 95),
    # Bills
    (r"electricity|water\s*bill|gas\s*bill|broadband|jio|airtel|vodafone|bsnl|recharge|postpaid|prepaid", "Bills & Utilities", 90),
    (r"rent\s*payment|house\s*rent|landlord", "Rent", 95),
    # Subscriptions
    (r"netflix|hotstar|prime\s*video|spotify|youtube\s*premium|apple\s*music|audible|gpay\s*subscription", "Subscriptions", 95),
    # Shopping
    (r"amazon|flipkart|myntra|ajio|nykaa|meesho|snapdeal|tatacliq|shoppers\s*stop|westside", "Shopping", 80),
    # Health
    (r"apollo|pharmeasy|1mg|netmeds|hospital|clinic|doctor|dental|lab\s*test|diagnostic|medical", "Health & Medical", 90),
    # Education
    (r"udemy|coursera|unacademy|byjus|school\s*fee|college|tuition|books", "Education", 85),
    # Insurance
    (r"lic|insurance|policy\s*premium|health\s*insurance|term\s*plan|hdfc\s*life|icici\s*pru", "Insurance", 90),
    # Investments
    (r"mutual\s*fund|zerodha|groww|upstox|sip|nps|ppf|fixed\s*deposit|fd\s*opening", "Investments", 85),
    # EMI
    (r"emi|loan\s*repayment|home\s*loan|car\s*loan|personal\s*loan|bajaj\s*finserv", "EMI & Loans", 95),
    # Salary (credit)
    (r"salary|neft.*salary|payroll|monthly\s*credit", "Salary", 100),
    # Cash
    (r"atm\s*withdrawal|cash\s*withdrawal|atm\s*cwl|nfs\s*atm", "Cash Withdrawal", 100),
    # Transfer
    (r"neft|rtgs|imps.*self|transfer\s*to\s*self|own\s*account", "Transfer", 80),
    # Refund
    (r"refund|cashback|reversal|chargeback", "Refund", 90),
    # Travel
    (r"makemytrip|goibibo|cleartrip|booking\.com|airbnb|hotel|flight|airport", "Travel", 85),
    # Personal care
    (r"salon|spa|parlour|parlor|grooming|urban\s*company|haircut", "Personal Care", 85),
]


async def seed_categories_and_rules(db: AsyncSession):
    """Insert default categories and rules if they don't exist."""
    existing = await db.execute(select(Category))
    if existing.scalars().first():
        return  # Already seeded

    cat_map = {}
    for name, icon, color in DEFAULT_CATEGORIES:
        cat = Category(name=name, icon=icon, color=color, is_system=True)
        db.add(cat)
        cat_map[name] = cat

    await db.flush()

    for pattern, cat_name, priority in DEFAULT_RULES:
        if cat_name in cat_map:
            rule = CategoryRule(
                pattern=pattern,
                category_id=cat_map[cat_name].id,
                priority=priority,
                source="SEED",
            )
            db.add(rule)

    await db.commit()

