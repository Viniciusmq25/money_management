from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, desc
from datetime import date, timedelta
from database import get_db
from auth import get_current_user
from models.transaction import Transaction, TransactionType
from models.category import Category
from models.investment import Investment
from services.coingecko import get_crypto_prices
from services.brapi import get_fii_quotes
from services.bcb import get_selic_cdi_rates

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


@router.get("/summary")
async def dashboard_summary(
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    # Current month totals
    income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == TransactionType.INCOME,
        Transaction.date >= month_start,
        Transaction.date <= today,
    ).scalar()

    expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= month_start,
        Transaction.date <= today,
    ).scalar()

    # Monthly trend (last N months)
    trend_start = (today - timedelta(days=30 * months)).replace(day=1)
    monthly_data = db.query(
        extract("year", Transaction.date).label("year"),
        extract("month", Transaction.date).label("month"),
        Transaction.type,
        func.sum(Transaction.amount).label("total"),
    ).filter(
        Transaction.date >= trend_start,
    ).group_by(
        extract("year", Transaction.date),
        extract("month", Transaction.date),
        Transaction.type,
    ).all()

    trend = {}
    for row in monthly_data:
        key = f"{int(row.year)}-{int(row.month):02d}"
        if key not in trend:
            trend[key] = {"month": key, "income": 0, "expense": 0}
        if row.type == TransactionType.INCOME:
            trend[key]["income"] = float(row.total)
        else:
            trend[key]["expense"] = float(row.total)

    monthly_trend = sorted(trend.values(), key=lambda x: x["month"])

    # Expense breakdown by category for current month
    cat_data = db.query(
        Category.name,
        Category.color,
        Category.icon,
        func.sum(Transaction.amount).label("total"),
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= month_start,
        Transaction.date <= today,
    ).group_by(Category.name, Category.color, Category.icon).order_by(desc("total")).all()

    expense_by_category = [
        {"name": row.name, "color": row.color, "icon": row.icon, "value": float(row.total)}
        for row in cat_data
    ]

    # Recent transactions
    recent = db.query(Transaction).options(
        joinedload(Transaction.category)
    ).order_by(desc(Transaction.date), desc(Transaction.id)).limit(5).all()

    recent_list = []
    for t in recent:
        recent_list.append({
            "id": t.id,
            "type": t.type.value,
            "amount": t.amount,
            "description": t.description,
            "date": t.date.isoformat(),
            "category": {"name": t.category.name, "color": t.category.color, "icon": t.category.icon} if t.category else None,
        })

    # Investment totals
    investments = db.query(Investment).all()
    total_invested = sum((i.quantity or 0) * (i.avg_price or 0) for i in investments)

    # Fetch market data
    market_data = {"rates": {"selic_annual": 0, "cdi_annual": 0}}
    try:
        crypto_tickers = [i.ticker for i in investments if i.type.value == "CRYPTO"]
        stock_tickers = [i.ticker for i in investments if i.type.value in ("FII", "ACAO_BR", "ACAO_GLOBAL")]

        if crypto_tickers:
            market_data["crypto"] = await get_crypto_prices(crypto_tickers, db)
        if stock_tickers:
            market_data["fii"] = await get_fii_quotes(stock_tickers, db)

        rates = await get_selic_cdi_rates(db)
        if rates:
            market_data["rates"] = rates
    except Exception:
        pass  # Keep default rates

    # Compute total current value
    total_current = 0
    for inv in investments:
        qty = inv.quantity or 0
        avg = inv.avg_price or 0
        invested = qty * avg
        
        # Determine current value logic
        if inv.type.value == "CRYPTO" and "crypto" in market_data and inv.ticker in market_data["crypto"]:
            total_current += qty * market_data["crypto"][inv.ticker]["price"]
        elif inv.type.value in ("FII", "ACAO_BR", "ACAO_GLOBAL") and "fii" in market_data and inv.ticker in market_data["fii"]:
            total_current += qty * market_data["fii"][inv.ticker]["price"]
        elif inv.type.value in ("RENDA_FIXA", "CAIXINHA_NUBANK", "CAIXINHA_TURBO_NUBANK"):
            # Reuse simplistic renda fixa logic from investments router if possible, or duplicate simplistic version here
            # For dashboard summary speed, we'll duplicate the simple logic or assume invested if calculation is complex
            # But let's try to match investments.py logic for consistency
            current_val = invested
            try:
                rates_data = market_data.get("rates", {})
                annual_rate = 0
                if inv.rate_type == "SELIC":
                    annual_rate = rates_data.get("selic_annual", 0) * (inv.rate_value or 100) / 100
                elif inv.rate_type == "CDI":
                    annual_rate = rates_data.get("cdi_annual", 0) * (inv.rate_value or 100) / 100
                elif inv.rate_type == "PREFIXADO":
                    annual_rate = inv.rate_value or 0
                
                if inv.purchase_date:
                    days = (today - inv.purchase_date).days
                    if days > 0:
                        daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                        factor = (1 + daily_rate) ** days  # using days as rough proxy for business days or just days
                        current_val = invested * factor
            except Exception:
                pass
            total_current += current_val
        else:
            total_current += invested

    inv_change_pct = ((total_current - total_invested) / total_invested * 100) if total_invested > 0 else 0

    return {
        "balance": float(income) - float(expense),
        "total_income": float(income),
        "total_expense": float(expense),
        "total_invested": total_invested,
        "total_current_value": total_current,
        "investment_change_pct": round(inv_change_pct, 2),
        "monthly_trend": monthly_trend,
        "expense_by_category": expense_by_category,
        "recent_transactions": recent_list,
        "market_data": market_data,
    }
