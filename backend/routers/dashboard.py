from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, desc, case
from datetime import date, timedelta
from database import get_db
from auth import get_current_user
from models.transaction import Transaction, TransactionType
from models.category import Category
from models.investment import Investment
from models.investment_deposit import InvestmentDeposit
from models.investment_redemption import InvestmentRedemption
from services.coingecko import get_crypto_prices
from services.brapi import get_fii_quotes
from services.bcb import get_selic_cdi_rates
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


@router.get("/summary")
async def dashboard_summary(
    months: int = Query(default=6, ge=1, le=24),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    granularity: str = Query(default="month"),
    db: Session = Depends(get_db),
):
    today = date.today()

    # Determine date range: explicit dates take priority over months
    if start_date and end_date:
        range_start = date.fromisoformat(start_date)
        range_end = date.fromisoformat(end_date)
    else:
        range_start = (today - timedelta(days=30 * months)).replace(day=1)
        range_end = today

    current_balance = db.query(
        func.coalesce(
            func.sum(
                case(
                    (Transaction.type == TransactionType.INCOME, Transaction.amount),
                    else_=-Transaction.amount,
                )
            ),
            0,
        )
    ).filter(
        Transaction.date <= today,
    ).scalar()

    # Period totals (filtered by selected range)
    income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == TransactionType.INCOME,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
    ).scalar()

    expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
    ).scalar()

    # Trend data grouped by granularity
    trend = {}
    if granularity == "day":
        daily_data = db.query(
            Transaction.date.label("day"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        ).filter(
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        ).group_by(
            Transaction.date,
            Transaction.type,
        ).all()

        for row in daily_data:
            key = row.day.isoformat()
            if key not in trend:
                trend[key] = {"month": key, "income": 0, "expense": 0}
            if row.type == TransactionType.INCOME:
                trend[key]["income"] = float(row.total)
            else:
                trend[key]["expense"] = float(row.total)
    else:
        monthly_data = db.query(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        ).filter(
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        ).group_by(
            extract("year", Transaction.date),
            extract("month", Transaction.date),
            Transaction.type,
        ).all()

        for row in monthly_data:
            key = f"{int(row.year)}-{int(row.month):02d}"
            if key not in trend:
                trend[key] = {"month": key, "income": 0, "expense": 0}
            if row.type == TransactionType.INCOME:
                trend[key]["income"] = float(row.total)
            else:
                trend[key]["expense"] = float(row.total)

    monthly_trend = sorted(trend.values(), key=lambda x: x["month"])

    # Expense breakdown by category for selected period
    cat_data = db.query(
        Category.name,
        Category.color,
        Category.icon,
        func.sum(Transaction.amount).label("total"),
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
    ).group_by(Category.name, Category.color, Category.icon).order_by(desc("total")).all()

    expense_by_category = [
        {"name": row.name, "color": row.color, "icon": row.icon, "value": float(row.total)}
        for row in cat_data
    ]

    # Category breakdown per period (for interactive charts)
    trend_by_category: dict[str, dict] = {}
    if granularity == "day":
        cat_trend_data = db.query(
            Transaction.date.label("day"),
            Transaction.type,
            Category.name,
            Category.color,
            func.sum(Transaction.amount).label("total"),
        ).join(Category, Transaction.category_id == Category.id).filter(
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        ).group_by(
            Transaction.date,
            Transaction.type,
            Category.name,
            Category.color,
        ).all()

        for row in cat_trend_data:
            key = row.day.isoformat()
            if key not in trend_by_category:
                trend_by_category[key] = {"income": [], "expense": []}
            bucket = "income" if row.type == TransactionType.INCOME else "expense"
            trend_by_category[key][bucket].append({
                "name": row.name,
                "color": row.color,
                "value": float(row.total),
            })
    else:
        cat_trend_data = db.query(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            Transaction.type,
            Category.name,
            Category.color,
            func.sum(Transaction.amount).label("total"),
        ).join(Category, Transaction.category_id == Category.id).filter(
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        ).group_by(
            extract("year", Transaction.date),
            extract("month", Transaction.date),
            Transaction.type,
            Category.name,
            Category.color,
        ).all()

        for row in cat_trend_data:
            key = f"{int(row.year)}-{int(row.month):02d}"
            if key not in trend_by_category:
                trend_by_category[key] = {"income": [], "expense": []}
            bucket = "income" if row.type == TransactionType.INCOME else "expense"
            trend_by_category[key][bucket].append({
                "name": row.name,
                "color": row.color,
                "value": float(row.total),
            })

    # Sort each period's categories by value desc
    for period_data in trend_by_category.values():
        period_data["income"].sort(key=lambda x: x["value"], reverse=True)
        period_data["expense"].sort(key=lambda x: x["value"], reverse=True)

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

    # Busca depósitos e resgates de RENDA_FIXA agrupados por investment_id
    renda_fixa_ids = [i.id for i in investments if i.type.value == "RENDA_FIXA"]
    deposits_by_inv: dict[int, list] = {}
    redemptions_by_inv: dict[int, list] = {}
    if renda_fixa_ids:
        all_deposits = db.query(InvestmentDeposit).filter(
            InvestmentDeposit.investment_id.in_(renda_fixa_ids)
        ).order_by(InvestmentDeposit.deposit_date).all()
        all_redemptions = db.query(InvestmentRedemption).filter(
            InvestmentRedemption.investment_id.in_(renda_fixa_ids)
        ).order_by(InvestmentRedemption.redemption_date).all()
        for d in all_deposits:
            deposits_by_inv.setdefault(d.investment_id, []).append(d)
        for r in all_redemptions:
            redemptions_by_inv.setdefault(r.investment_id, []).append(r)

    def get_inv_invested(inv: Investment) -> float:
        """Retorna o valor total investido para um investimento."""
        if inv.type.value == "RENDA_FIXA":
            deps = deposits_by_inv.get(inv.id, [])
            reds = redemptions_by_inv.get(inv.id, [])
            if deps or reds:
                return sum(d.amount for d in deps) - sum(r.amount for r in reds)
            return 0
        return (inv.quantity or 0) * (inv.avg_price or 0)

    total_invested = sum(get_inv_invested(i) for i in investments)

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
    except Exception as e:
        logger.error(f"Erro ao buscar dados de mercado para dashboard: {str(e)}")

    # Compute total current value
    total_current = 0
    for inv in investments:
        qty = inv.quantity or 0
        avg = inv.avg_price or 0
        invested = get_inv_invested(inv)

        # Determine current value logic
        if inv.type.value == "CRYPTO" and "crypto" in market_data and inv.ticker in market_data["crypto"]:
            total_current += qty * market_data["crypto"][inv.ticker]["price"]
        elif inv.type.value in ("FII", "ACAO_BR", "ACAO_GLOBAL") and "fii" in market_data and inv.ticker in market_data["fii"]:
            total_current += qty * market_data["fii"][inv.ticker]["price"]
        elif inv.type.value == "RENDA_FIXA":
            deps = deposits_by_inv.get(inv.id, [])
            reds = redemptions_by_inv.get(inv.id, [])
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

                if deps and annual_rate > 0:
                    # Cálculo por depósito (ex-caixinhas): cada aporte rende individualmente
                    total_val = 0
                    for dep in deps:
                        days = (today - dep.deposit_date).days
                        if days > 0:
                            daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                            total_val += dep.amount * (1 + daily_rate) ** days
                        else:
                            total_val += dep.amount
                    for red in reds:
                        days = (today - red.redemption_date).days
                        if days > 0:
                            daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                            total_val -= red.amount * (1 + daily_rate) ** days
                        else:
                            total_val -= red.amount
                    current_val = total_val
                elif not deps and annual_rate > 0:
                    # Sem depósitos: sem rendimento calculável
                    pass
            except Exception as e:
                logger.warning(f"Erro ao calcular valor atual de renda fixa para investimento {inv.id}: {str(e)}")
            total_current += current_val
        else:
            total_current += invested

    inv_change_pct = ((total_current - total_invested) / total_invested * 100) if total_invested > 0 else 0

    return {
        "current_balance": float(current_balance),
        "monthly_result": float(income) - float(expense),
        "total_income": float(income),
        "total_expense": float(expense),
        "total_invested": total_invested,
        "total_current_value": total_current,
        "investment_change_pct": round(inv_change_pct, 2),
        "monthly_trend": monthly_trend,
        "expense_by_category": expense_by_category,
        "trend_by_category": trend_by_category,
        "recent_transactions": recent_list,
        "market_data": market_data,
    }
