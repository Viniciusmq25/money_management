from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, desc, case
from datetime import date, timedelta, datetime, timezone
from database import get_db
from auth import get_current_user
from models.user import User
from models.transaction import Transaction, TransactionType
from models.category import Category
from models.investment import Investment
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

    income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == uid,
        Transaction.type == TransactionType.INCOME,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
    ).scalar()

    expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == uid,
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= range_start,
        Transaction.date <= range_end,
    ).scalar()

    trend = {}
    if granularity == "day":
        daily_data = db.query(
            Transaction.date.label("day"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        ).filter(
            Transaction.user_id == uid,
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
            Transaction.user_id == uid,
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
