from __future__ import annotations

from datetime import date, timedelta
import json
from typing import Optional

import httpx
from sqlalchemy import case, desc, extract, func
from sqlalchemy.orm import Session, joinedload

from config import get_settings
from models.category import Category
from models.goal import Goal
from models.investment import Investment
from models.investment_deposit import InvestmentDeposit
from models.investment_redemption import InvestmentRedemption
from models.transaction import Transaction, TransactionType
from services.brapi import get_fii_quotes
from services.coingecko import get_crypto_prices


def _round_money(value: Optional[float]) -> float:
    return round(float(value or 0), 2)


def _build_purchase_scenario(snapshot: dict, purchase_amount: Optional[float], purchase_description: Optional[str]) -> Optional[dict]:
    if not purchase_amount:
        return None

    current_balance = snapshot["current_balance"]
    monthly_income = snapshot["monthly_income"]
    monthly_result = snapshot["monthly_result"]

    return {
        "amount": _round_money(purchase_amount),
        "description": purchase_description or None,
        "balance_after_purchase": _round_money(current_balance - purchase_amount),
        "monthly_result_after_purchase": _round_money(monthly_result - purchase_amount),
        "purchase_vs_balance_pct": round((purchase_amount / current_balance) * 100, 2) if current_balance > 0 else None,
        "purchase_vs_income_pct": round((purchase_amount / monthly_income) * 100, 2) if monthly_income > 0 else None,
    }


async def build_financial_snapshot(
    db: Session,
    *,
    purchase_amount: Optional[float] = None,
    purchase_description: Optional[str] = None,
    trend_months: int = 6,
) -> dict:
    today = date.today()
    month_start = today.replace(day=1)
    trend_start = (today - timedelta(days=30 * trend_months)).replace(day=1)

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
    ).filter(Transaction.date <= today).scalar()

    monthly_income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == TransactionType.INCOME,
        Transaction.date >= month_start,
        Transaction.date <= today,
    ).scalar()

    monthly_expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= month_start,
        Transaction.date <= today,
    ).scalar()

    monthly_rows = db.query(
        extract("year", Transaction.date).label("year"),
        extract("month", Transaction.date).label("month"),
        Transaction.type.label("type"),
        func.sum(Transaction.amount).label("total"),
    ).filter(
        Transaction.date >= trend_start,
        Transaction.date <= today,
    ).group_by(
        extract("year", Transaction.date),
        extract("month", Transaction.date),
        Transaction.type,
    ).all()

    monthly_map: dict[str, dict[str, float]] = {}
    for row in monthly_rows:
        month_key = f"{int(row.year)}-{int(row.month):02d}"
        if month_key not in monthly_map:
            monthly_map[month_key] = {"income": 0.0, "expense": 0.0}
        monthly_map[month_key]["income" if row.type == TransactionType.INCOME else "expense"] = float(row.total or 0)

    monthly_values = list(monthly_map.values())
    month_count = max(len(monthly_values), 1)
    average_monthly_income = sum(item["income"] for item in monthly_values) / month_count if monthly_values else 0
    average_monthly_expense = sum(item["expense"] for item in monthly_values) / month_count if monthly_values else 0

    top_expense_categories_rows = db.query(
        Category.name,
        Category.color,
        func.sum(Transaction.amount).label("total"),
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.type == TransactionType.EXPENSE,
        Transaction.date >= month_start,
        Transaction.date <= today,
    ).group_by(
        Category.name,
        Category.color,
    ).order_by(desc("total")).limit(5).all()

    goals = db.query(Goal).order_by(Goal.deadline.is_(None), Goal.deadline.asc(), Goal.id.asc()).all()
    goal_items = []
    for goal in goals:
        remaining_amount = max((goal.target_amount or 0) - (goal.current_amount or 0), 0)
        progress = ((goal.current_amount or 0) / goal.target_amount * 100) if goal.target_amount else 0
        goal_items.append({
            "name": goal.name,
            "target_amount": _round_money(goal.target_amount),
            "current_amount": _round_money(goal.current_amount),
            "remaining_amount": _round_money(remaining_amount),
            "progress": round(progress, 2),
            "deadline": goal.deadline.isoformat() if goal.deadline else None,
        })

    investments = db.query(Investment).all()
    renda_fixa_ids = [investment.id for investment in investments if investment.type.value == "RENDA_FIXA"]
    deposits_by_inv: dict[int, list[InvestmentDeposit]] = {}
    redemptions_by_inv: dict[int, list[InvestmentRedemption]] = {}
    if renda_fixa_ids:
        deposits = db.query(InvestmentDeposit).filter(
            InvestmentDeposit.investment_id.in_(renda_fixa_ids)
        ).all()
        redemptions = db.query(InvestmentRedemption).filter(
            InvestmentRedemption.investment_id.in_(renda_fixa_ids)
        ).all()
        for deposit in deposits:
            deposits_by_inv.setdefault(deposit.investment_id, []).append(deposit)
        for redemption in redemptions:
            redemptions_by_inv.setdefault(redemption.investment_id, []).append(redemption)

    def get_invested_amount(investment: Investment) -> float:
        if investment.type.value == "RENDA_FIXA":
            deposits = deposits_by_inv.get(investment.id, [])
            redemptions = redemptions_by_inv.get(investment.id, [])
            if deposits or redemptions:
                return sum(item.amount for item in deposits) - sum(item.amount for item in redemptions)
            return investment.original_amount or ((investment.quantity or 0) * (investment.avg_price or 0))
        return (investment.quantity or 0) * (investment.avg_price or 0)

    total_invested = sum(get_invested_amount(investment) for investment in investments)
    total_current_value = total_invested

    try:
        crypto_tickers = [investment.ticker for investment in investments if investment.type.value == "CRYPTO"]
        stock_tickers = [investment.ticker for investment in investments if investment.type.value in ("FII", "ACAO_BR", "ACAO_GLOBAL")]
        market_crypto = await get_crypto_prices(crypto_tickers, db) if crypto_tickers else {}
        market_stocks = await get_fii_quotes(stock_tickers, db) if stock_tickers else {}

        total_current_value = 0
        for investment in investments:
            invested_amount = get_invested_amount(investment)
            quantity = investment.quantity or 0
            if investment.type.value == "CRYPTO" and investment.ticker in market_crypto:
                total_current_value += quantity * market_crypto[investment.ticker]["price"]
            elif investment.type.value in ("FII", "ACAO_BR", "ACAO_GLOBAL") and investment.ticker in market_stocks:
                total_current_value += quantity * market_stocks[investment.ticker]["price"]
            else:
                total_current_value += invested_amount
    except Exception:
        total_current_value = total_invested

    recent_transactions = db.query(Transaction).options(
        joinedload(Transaction.category)
    ).order_by(desc(Transaction.date), desc(Transaction.id)).limit(8).all()

    snapshot = {
        "generated_at": today.isoformat(),
        "current_balance": _round_money(current_balance),
        "monthly_income": _round_money(monthly_income),
        "monthly_expense": _round_money(monthly_expense),
        "monthly_result": _round_money(float(monthly_income or 0) - float(monthly_expense or 0)),
        "average_monthly_income": _round_money(average_monthly_income),
        "average_monthly_expense": _round_money(average_monthly_expense),
        "average_monthly_result": _round_money(average_monthly_income - average_monthly_expense),
        "goals_total_target": _round_money(sum(item["target_amount"] for item in goal_items)),
        "goals_total_current": _round_money(sum(item["current_amount"] for item in goal_items)),
        "goals_total_gap": _round_money(sum(item["remaining_amount"] for item in goal_items)),
        "goals": goal_items,
        "top_expense_categories": [
            {
                "name": row.name,
                "total": _round_money(row.total),
                "color": row.color,
            }
            for row in top_expense_categories_rows
        ],
        "recent_transactions": [
            {
                "description": transaction.description,
                "type": transaction.type.value,
                "amount": _round_money(transaction.amount),
                "date": transaction.date.isoformat(),
                "category": transaction.category.name if transaction.category else None,
            }
            for transaction in recent_transactions
        ],
        "investments": {
            "total_invested": _round_money(total_invested),
            "total_current_value": _round_money(total_current_value),
            "investment_change_pct": round(((total_current_value - total_invested) / total_invested * 100), 2) if total_invested > 0 else 0,
            "positions_count": len(investments),
        },
    }
    snapshot["purchase_scenario"] = _build_purchase_scenario(snapshot, purchase_amount, purchase_description)
    return snapshot


def build_assistant_system_prompt(snapshot: dict) -> str:
    return f"""
Você é um assistente financeiro pessoal do sistema Money Management.

Regras obrigatórias:
- Responda sempre em português do Brasil.
- Baseie a análise SOMENTE nos dados fornecidos pelo sistema.
- Não diga que acessou banco de dados, tela ou histórico fora deste contexto.
- Não invente números ausentes. Se faltar dado, diga isso com clareza.
- Não trate a resposta como consultoria profissional, fiscal, jurídica ou recomendação definitiva de investimento.
- Ao avaliar compras, considere saldo atual, resultado do mês, metas e folga média mensal.
- Ao sugerir planos, prefira passos concretos, simples e executáveis.
- Seja direto. Sem enrolação.
- Quando fizer sentido, cite números do contexto para justificar a conclusão.

Contexto financeiro consolidado do usuário:
{json.dumps(snapshot, ensure_ascii=False, indent=2)}
""".strip()


async def generate_assistant_reply(
    *,
    message: str,
    history: list[dict],
    snapshot: dict,
) -> tuple[str, str]:
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY não configurada")

    messages = []
    for item in history[-6:]:
        messages.append({"role": item["role"], "content": [{"type": "text", "text": item["content"]}]})
    messages.append({"role": "user", "content": [{"type": "text", "text": message}]})

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.ANTHROPIC_MODEL,
                "max_tokens": settings.ANTHROPIC_MAX_TOKENS,
                "temperature": 0.3,
                "system": build_assistant_system_prompt(snapshot),
                "messages": messages,
            },
        )
        response.raise_for_status()
        payload = response.json()

    text_blocks = [block.get("text", "") for block in payload.get("content", []) if block.get("type") == "text"]
    reply = "\n".join(block for block in text_blocks if block).strip()
    return reply or "Não consegui gerar uma resposta útil com os dados atuais.", settings.ANTHROPIC_MODEL