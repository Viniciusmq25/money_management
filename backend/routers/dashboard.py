from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, desc, case, or_
from datetime import date, timedelta, datetime, timezone
from database import get_db
from auth import get_current_user
from models.user import User
from models.transaction import Transaction, TransactionType
from models.category import Category
from models.investment import Investment, InvestmentType
from models.investment_deposit import InvestmentDeposit
from models.investment_redemption import InvestmentRedemption
from models.stock_transaction import StockTransaction
from services.bcb import get_selic_cdi_rates
from routers.investments import enrich_investments as _enrich_investments
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(
    months: int = Query(default=6, ge=1, le=24),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    granularity: str = Query(default="month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = datetime.now(timezone.utc).date()
    uid = current_user.id

    # Determine date range: explicit dates take priority over months
    if start_date and end_date:
        range_start = date.fromisoformat(start_date)
        range_end = date.fromisoformat(end_date)
    else:
        range_start = (today - timedelta(days=30 * months)).replace(day=1)
        range_end = today

    # Categories flagged to be excluded from regular income/expense reports
    # (e.g., "Investimentos" — money moves in/out but isn't real spending/earning)
    flagged_ids = [
        cid for (cid,) in db.query(Category.id).filter(
            Category.user_id == uid,
            Category.exclude_from_reports == True,
        ).all()
    ]

    def not_flagged_clause():
        if not flagged_ids:
            return None
        return or_(
            Transaction.category_id.is_(None),
            Transaction.category_id.notin_(flagged_ids),
        )

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
        Transaction.user_id == uid,
        Transaction.date <= today,
    ).scalar()

    income_q = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == uid,
        Transaction.type == TransactionType.INCOME,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
    )
    if (clause := not_flagged_clause()) is not None:
        income_q = income_q.filter(clause)
    income = income_q.scalar()

    expense_q = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == uid,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
    )
    if (clause := not_flagged_clause()) is not None:
        expense_q = expense_q.filter(clause)
    expense = expense_q.scalar()

    trend = {}
    if granularity == "day":
        daily_q = db.query(
            Transaction.date.label("day"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        ).filter(
            Transaction.user_id == uid,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        )
        if (clause := not_flagged_clause()) is not None:
            daily_q = daily_q.filter(clause)
        daily_data = daily_q.group_by(
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
        monthly_q = db.query(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        ).filter(
            Transaction.user_id == uid,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        )
        if (clause := not_flagged_clause()) is not None:
            monthly_q = monthly_q.filter(clause)
        monthly_data = monthly_q.group_by(
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

    cat_data = db.query(
        Category.name,
        Category.color,
        Category.icon,
        func.sum(Transaction.amount).label("total"),
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.user_id == uid,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
        Category.exclude_from_reports == False,
    ).group_by(Category.name, Category.color, Category.icon).order_by(desc("total")).all()

    expense_by_category = [
        {"name": row.name, "color": row.color, "icon": row.icon, "value": float(row.total)}
        for row in cat_data
    ]

    trend_by_category: dict[str, dict] = {}
    if granularity == "day":
        cat_trend_data = db.query(
            Transaction.date.label("day"),
            Transaction.type,
            Category.name,
            Category.color,
            func.sum(Transaction.amount).label("total"),
        ).join(Category, Transaction.category_id == Category.id).filter(
            Transaction.user_id == uid,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
            Category.exclude_from_reports == False,
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
            Transaction.user_id == uid,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
            Category.exclude_from_reports == False,
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

    for period_data in trend_by_category.values():
        period_data["income"].sort(key=lambda x: x["value"], reverse=True)
        period_data["expense"].sort(key=lambda x: x["value"], reverse=True)

    recent = db.query(Transaction).options(
        joinedload(Transaction.category)
    ).filter(Transaction.user_id == uid).order_by(desc(Transaction.date), desc(Transaction.id)).limit(5).all()

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

    investments = db.query(Investment).filter(Investment.user_id == uid).all()
    enriched = await _enrich_investments(investments, db)

    total_invested = sum(e["total_invested"] or 0 for e in enriched)
    total_current = sum(e["current_value"] if e["current_value"] is not None else (e["total_invested"] or 0) for e in enriched)

    market_data = {"rates": {"selic_annual": 0, "cdi_annual": 0}}
    try:
        rates = await get_selic_cdi_rates(db)
        if rates:
            market_data["rates"] = rates
    except Exception as e:
        logger.error(f"Erro ao buscar taxas de mercado para dashboard: {str(e)}")

    inv_change_pct = ((total_current - total_invested) / total_invested * 100) if total_invested > 0 else 0

    # === investment_trend: aggregate of flagged-category transactions per period ===
    investment_trend: dict[str, dict] = {}
    if flagged_ids:
        if granularity == "day":
            inv_data = db.query(
                Transaction.date.label("day"),
                Transaction.type,
                func.sum(Transaction.amount).label("total"),
            ).filter(
                Transaction.user_id == uid,
                Transaction.date >= range_start,
                Transaction.date <= range_end,
                Transaction.category_id.in_(flagged_ids),
            ).group_by(Transaction.date, Transaction.type).all()
            for row in inv_data:
                key = row.day.isoformat()
                if key not in investment_trend:
                    investment_trend[key] = {"income_in": 0.0, "expense_out": 0.0}
                bucket = "income_in" if row.type == TransactionType.INCOME else "expense_out"
                investment_trend[key][bucket] = float(row.total)
        else:
            inv_data = db.query(
                extract("year", Transaction.date).label("year"),
                extract("month", Transaction.date).label("month"),
                Transaction.type,
                func.sum(Transaction.amount).label("total"),
            ).filter(
                Transaction.user_id == uid,
                Transaction.date >= range_start,
                Transaction.date <= range_end,
                Transaction.category_id.in_(flagged_ids),
            ).group_by(
                extract("year", Transaction.date),
                extract("month", Transaction.date),
                Transaction.type,
            ).all()
            for row in inv_data:
                key = f"{int(row.year)}-{int(row.month):02d}"
                if key not in investment_trend:
                    investment_trend[key] = {"income_in": 0.0, "expense_out": 0.0}
                bucket = "income_in" if row.type == TransactionType.INCOME else "expense_out"
                investment_trend[key][bucket] = float(row.total)

    # === equity_trend: cash + invested-at-cost per period (CRYPTO not tracked, contributes 0) ===
    opening_balance = db.query(
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
        Transaction.user_id == uid,
        Transaction.date < range_start,
    ).scalar()

    if granularity == "day":
        all_data = db.query(
            Transaction.date.label("day"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        ).filter(
            Transaction.user_id == uid,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        ).group_by(Transaction.date, Transaction.type).all()
        all_periods: dict[str, float] = {}
        for row in all_data:
            key = row.day.isoformat()
            delta = float(row.total) if row.type == TransactionType.INCOME else -float(row.total)
            all_periods[key] = all_periods.get(key, 0.0) + delta
    else:
        all_data = db.query(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        ).filter(
            Transaction.user_id == uid,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
        ).group_by(
            extract("year", Transaction.date),
            extract("month", Transaction.date),
            Transaction.type,
        ).all()
        all_periods = {}
        for row in all_data:
            key = f"{int(row.year)}-{int(row.month):02d}"
            delta = float(row.total) if row.type == TransactionType.INCOME else -float(row.total)
            all_periods[key] = all_periods.get(key, 0.0) + delta

    # Load investment events to compute invested-at-cost per period
    rf_deposits = db.query(InvestmentDeposit.deposit_date, InvestmentDeposit.amount).join(
        Investment, InvestmentDeposit.investment_id == Investment.id
    ).filter(
        Investment.user_id == uid,
        Investment.type == InvestmentType.RENDA_FIXA,
    ).all()
    rf_redemptions = db.query(InvestmentRedemption.redemption_date, InvestmentRedemption.amount).join(
        Investment, InvestmentRedemption.investment_id == Investment.id
    ).filter(
        Investment.user_id == uid,
        Investment.type == InvestmentType.RENDA_FIXA,
    ).all()
    stock_events = db.query(
        StockTransaction.investment_id,
        StockTransaction.type,
        StockTransaction.quantity,
        StockTransaction.price_per_share,
        StockTransaction.date,
    ).join(Investment, StockTransaction.investment_id == Investment.id).filter(
        Investment.user_id == uid,
        Investment.type.in_([InvestmentType.FII, InvestmentType.ACAO_BR, InvestmentType.ACAO_GLOBAL]),
    ).order_by(StockTransaction.date).all()

    stock_by_inv: dict[int, list] = {}
    for tx in stock_events:
        stock_by_inv.setdefault(tx.investment_id, []).append(tx)

    def invested_at(period_end: date) -> float:
        rf = (
            sum(d.amount for d in rf_deposits if d.deposit_date <= period_end)
            - sum(r.amount for r in rf_redemptions if r.redemption_date <= period_end)
        )
        stock_total = 0.0
        for txs in stock_by_inv.values():
            qty, avg = 0.0, 0.0
            for tx in txs:
                if tx.date > period_end:
                    break
                if tx.type == "COMPRA":
                    total_cost = qty * avg + tx.quantity * tx.price_per_share
                    qty += tx.quantity
                    avg = total_cost / qty if qty > 0 else 0.0
                else:
                    qty = max(qty - tx.quantity, 0.0)
            stock_total += qty * avg
        return float(rf) + stock_total

    equity_trend = []
    running_cash = float(opening_balance)
    for key in sorted(all_periods.keys()):
        running_cash += all_periods[key]
        if granularity == "day":
            period_end = date.fromisoformat(key)
        else:
            y, m = map(int, key.split("-"))
            period_end = (date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)) - timedelta(days=1)
        if period_end > range_end:
            period_end = range_end
        equity_trend.append({"month": key, "equity": running_cash + invested_at(period_end)})

    # === last_30d_expense_by_category: dashboard pie (excludes flagged) ===
    last_30d_start = today - timedelta(days=30)
    last_30d_data = db.query(
        Category.name,
        Category.color,
        Category.icon,
        func.sum(Transaction.amount).label("total"),
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.user_id == uid,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= last_30d_start,
        Transaction.date <= today,
        Category.exclude_from_reports == False,
    ).group_by(Category.name, Category.color, Category.icon).order_by(desc("total")).all()

    last_30d_expense_by_category = [
        {"name": row.name, "color": row.color, "icon": row.icon, "value": float(row.total)}
        for row in last_30d_data
    ]

    # === total_invested_net_period: EXPENSE flagged − INCOME flagged in period ===
    total_invested_net_period = 0.0
    if flagged_ids:
        flagged_expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.user_id == uid,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
            Transaction.category_id.in_(flagged_ids),
        ).scalar()
        flagged_income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.user_id == uid,
            Transaction.type == TransactionType.INCOME,
            Transaction.date >= range_start,
            Transaction.date <= range_end,
            Transaction.category_id.in_(flagged_ids),
        ).scalar()
        total_invested_net_period = float(flagged_expense) - float(flagged_income)

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
        "investment_trend": investment_trend,
        "equity_trend": equity_trend,
        "last_30d_expense_by_category": last_30d_expense_by_category,
        "total_invested_net_period": total_invested_net_period,
        "recent_transactions": recent_list,
        "market_data": market_data,
    }
