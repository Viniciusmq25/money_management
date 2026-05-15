from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.user import User
from models.investment import Investment, InvestmentType
from models.investment_deposit import InvestmentDeposit
from models.investment_redemption import InvestmentRedemption
from models.stock_transaction import StockTransaction
from models.api_config import APIConfig
from schemas import (
    InvestmentCreate, InvestmentUpdate, InvestmentResponse,
    InvestmentDepositCreate, InvestmentDepositResponse,
    InvestmentRedemptionCreate, InvestmentRedemptionResponse,
    StockTransactionCreate, StockTransactionResponse,
    BinanceConfigCreate, BinanceConfigResponse, BinanceSyncResponse,
)

STOCK_TYPES = (InvestmentType.FII, InvestmentType.ACAO_BR, InvestmentType.ACAO_GLOBAL)
from services.coingecko import get_crypto_prices
from services.brapi import get_fii_quotes, get_stock_quotes
from services.bcb import get_selic_cdi_rates
from services.binance import sync_binance_investments, get_binance_status, test_connection, BinanceError
import logging
from datetime import date, datetime, timezone
from collections import defaultdict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/investments", tags=["investments"])


# === Batch Enrichment ===

async def enrich_investments(investments: list[Investment], db: Session) -> list[dict]:
    """Batch-enrich investments: one API call per asset type instead of per investment."""
    if not investments:
        return []

    # Group tickers by type
    by_type: dict[InvestmentType, list[Investment]] = defaultdict(list)
    for inv in investments:
        by_type[inv.type].append(inv)

    # Fetch all prices in batch (one call per type)
    prices: dict[str, dict] = {}
    rates = None

    try:
        crypto_tickers = [inv.ticker for inv in by_type.get(InvestmentType.CRYPTO, [])]
        if crypto_tickers:
            prices.update(await get_crypto_prices(crypto_tickers, db))

        fii_tickers = [inv.ticker for inv in by_type.get(InvestmentType.FII, [])]
        if fii_tickers:
            prices.update(await get_fii_quotes(fii_tickers, db))

        br_tickers = [inv.ticker for inv in by_type.get(InvestmentType.ACAO_BR, [])]
        if br_tickers:
            prices.update(await get_stock_quotes(br_tickers, db, asset_type="ACAO_BR"))

        global_tickers = [inv.ticker for inv in by_type.get(InvestmentType.ACAO_GLOBAL, [])]
        if global_tickers:
            prices.update(await get_stock_quotes(global_tickers, db, asset_type="ACAO_GLOBAL"))

        if InvestmentType.RENDA_FIXA in by_type:
            rates = await get_selic_cdi_rates(db)
    except Exception as e:
        logger.error(f"Batch price fetch error: {e}", exc_info=True)

    # Enrich each investment
    result = []
    for inv in investments:
        data = _build_enriched(inv, prices, rates)
        result.append(data)

    return result


def _build_enriched(inv: Investment, prices: dict, rates: dict | None) -> dict:
    """Build enriched dict for a single investment using pre-fetched prices."""
    deposits = inv.deposits or []
    redemptions = inv.redemptions or []
    stock_txs = inv.stock_transactions if hasattr(inv, 'stock_transactions') else []

    realized = 0.0
    cost_basis = 0.0
    if inv.type in STOCK_TYPES and stock_txs:
        sorted_txs = sorted(stock_txs, key=lambda t: t.date)
        qty, avg = 0.0, 0.0
        for t in sorted_txs:
            if t.type == "COMPRA":
                total_cost = qty * avg + t.quantity * t.price_per_share
                qty += t.quantity
                avg = total_cost / qty
            else:  # VENDA
                realized += t.quantity * (t.price_per_share - avg)
                qty = max(qty - t.quantity, 0)
        cost_basis = sum(t.quantity * t.price_per_share for t in stock_txs if t.type == "COMPRA")
    else:
        qty = inv.quantity or 0
        avg = inv.avg_price or 0
        cost_basis = qty * avg

    # For market assets: total_invested = qty * avg_price (open position only)
    # For RENDA_FIXA: total_invested = sum(deposits) - sum(redemptions)
    if inv.type == InvestmentType.RENDA_FIXA:
        total_invested = sum(d.amount for d in deposits) - sum(r.amount for r in redemptions)
    else:
        total_invested = qty * avg

    data = {
        "id": inv.id,
        "type": inv.type,
        "ticker": inv.ticker,
        "name": inv.name,
        "quantity": qty,
        "avg_price": avg,
        "rate_type": inv.rate_type,
        "rate_value": inv.rate_value,
        "maturity_date": inv.maturity_date,
        "created_at": inv.created_at,
        "deposits": [{"id": d.id, "investment_id": d.investment_id, "amount": d.amount, "deposit_date": d.deposit_date, "created_at": d.created_at} for d in deposits],
        "redemptions": [{"id": r.id, "investment_id": r.investment_id, "amount": r.amount, "redemption_date": r.redemption_date, "created_at": r.created_at} for r in redemptions],
        "stock_transactions": [{"id": t.id, "investment_id": t.investment_id, "type": t.type, "quantity": t.quantity, "price_per_share": t.price_per_share, "date": t.date, "created_at": t.created_at} for t in stock_txs],
        "total_invested": total_invested,
        "current_price": None,
        "change_24h": None,
        "current_value": None,
        "profit_loss": None,
        "profit_loss_pct": None,
        "realized_profit_loss": realized if inv.type in STOCK_TYPES else None,
        "unrealized_profit_loss": None,
    }

    try:
        if inv.type in (InvestmentType.CRYPTO, InvestmentType.FII, InvestmentType.ACAO_BR, InvestmentType.ACAO_GLOBAL):
            quote = prices.get(inv.ticker)
            if quote:
                data["current_price"] = quote["price"]
                data["change_24h"] = quote.get("change_24h")
                data["current_value"] = qty * quote["price"]

        elif inv.type == InvestmentType.RENDA_FIXA:
            if deposits and rates:
                data["current_value"] = _calculate_caixinha_value(deposits, redemptions, inv, rates)
    except Exception as e:
        logger.error(f"Enrichment error for {inv.id} ({inv.ticker}): {e}", exc_info=True)

    if data["current_value"] is not None:
        if inv.type in STOCK_TYPES:
            # Only compute PL when we have a recorded cost basis. Without it (no stock_txs),
            # current_value - 0 would be reported as pure profit ("phantom profit").
            if cost_basis > 0:
                unrealized = data["current_value"] - (qty * avg)
                data["unrealized_profit_loss"] = unrealized
                total_pl = realized + unrealized
                data["profit_loss"] = total_pl
                data["profit_loss_pct"] = (total_pl / cost_basis) * 100
        else:
            # RENDA_FIXA / CRYPTO: use total_invested as cost basis.
            # When total_invested == 0 (airdrop, transfer without buy history), leave PL as None.
            if data["total_invested"] and data["total_invested"] > 0:
                data["profit_loss"] = data["current_value"] - data["total_invested"]
                data["profit_loss_pct"] = (data["profit_loss"] / data["total_invested"]) * 100
    elif inv.type in STOCK_TYPES and realized != 0:
        # fully closed position: no market price but has realized gain/loss
        data["unrealized_profit_loss"] = 0.0
        data["profit_loss"] = realized
        data["profit_loss_pct"] = (realized / cost_basis * 100) if cost_basis > 0 else None

    return data


def _calculate_caixinha_value(deposits, redemptions, inv: Investment, rates: dict) -> float:
    """Calculate caixinha current value based on deposits/redemptions with rate growth."""
    net = sum(d.amount for d in deposits) - sum(r.amount for r in redemptions)
    if not deposits and not redemptions:
        return 0
    if not inv.rate_type or not inv.rate_value:
        return net

    annual_rate = 0
    if inv.rate_type == "SELIC":
        annual_rate = rates.get("selic_annual", 0) * (inv.rate_value or 100) / 100
    elif inv.rate_type == "CDI":
        annual_rate = rates.get("cdi_annual", 0) * (inv.rate_value or 100) / 100
    elif inv.rate_type == "PREFIXADO":
        annual_rate = inv.rate_value or 0

    if annual_rate <= 0:
        return net

    today = datetime.now(timezone.utc).date()
    daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
    total_value = 0

    for deposit in deposits:
        days = (today - deposit.deposit_date).days
        factor = (1 + daily_rate) ** days if days > 0 else 1
        total_value += deposit.amount * factor

    for redemption in redemptions:
        days = (today - redemption.redemption_date).days
        factor = (1 + daily_rate) ** days if days > 0 else 1
        total_value -= redemption.amount * factor

    return total_value


async def enrich_investment(inv: Investment, db: Session) -> dict:
    """Single-investment enrichment (thin wrapper around batch version)."""
    results = await enrich_investments([inv], db)
    return results[0] if results else {}


# === CRUD ===

@router.get("", response_model=list[InvestmentResponse])
async def list_investments(
    type: InvestmentType | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Investment).filter(Investment.user_id == current_user.id)
    if type:
        query = query.filter(Investment.type == type)
    investments = query.order_by(Investment.type, Investment.ticker).all()
    return await enrich_investments(investments, db)


@router.post("", response_model=InvestmentResponse)
async def create_investment(
    data: InvestmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Investment).filter(
        Investment.user_id == current_user.id,
        Investment.ticker == data.ticker.upper(),
        Investment.type == data.type,
    ).first()

    if existing and data.type in STOCK_TYPES:
        raise HTTPException(status_code=409, detail="Ativo já cadastrado")

    if existing:
        # Weighted average for market assets
        old_total = (existing.quantity or 0) * (existing.avg_price or 0)
        new_total = (data.quantity or 0) * (data.avg_price or 0)
        new_quantity = (existing.quantity or 0) + (data.quantity or 0)
        existing.quantity = new_quantity
        existing.avg_price = (old_total + new_total) / new_quantity if new_quantity > 0 else 0
        if data.rate_type:
            existing.rate_type = data.rate_type
        if data.rate_value:
            existing.rate_value = data.rate_value
        if data.maturity_date:
            existing.maturity_date = data.maturity_date
        db.commit()
        db.refresh(existing)
        return await enrich_investment(existing, db)

    payload = data.model_dump()
    payload["ticker"] = payload["ticker"].upper()
    if data.type in STOCK_TYPES:
        payload["quantity"] = 0
        payload["avg_price"] = 0
    inv = Investment(user_id=current_user.id, **payload)
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return await enrich_investment(inv, db)


@router.put("/{id}", response_model=InvestmentResponse)
async def update_investment(
    id: int,
    data: InvestmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Investment).filter(Investment.id == id, Investment.user_id == current_user.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(inv, key, val)
    db.commit()
    db.refresh(inv)
    return await enrich_investment(inv, db)


@router.delete("/{id}")
async def delete_investment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Investment).filter(Investment.id == id, Investment.user_id == current_user.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    db.delete(inv)
    db.commit()
    return {"ok": True}


@router.get("/summary")
async def investment_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    investments = db.query(Investment).filter(Investment.user_id == current_user.id).all()
    enriched = await enrich_investments(investments, db)

    by_type = {}
    total_invested = 0
    total_current = 0
    for e in enriched:
        t = e["type"].value if hasattr(e["type"], "value") else e["type"]
        if t not in by_type:
            by_type[t] = {"invested": 0, "current": 0, "count": 0}
        by_type[t]["count"] += 1
        # Skip currency aggregates for positions with unknown cost basis
        # (e.g., airdrops, transfers without buy history) — they would otherwise inflate totals.
        has_known_cost = (e.get("total_invested") or 0) > 0 or e.get("profit_loss") is not None
        if not has_known_cost:
            continue
        by_type[t]["invested"] += e["total_invested"] or 0
        by_type[t]["current"] += e["current_value"] or e["total_invested"] or 0
        total_invested += e["total_invested"] or 0
        total_current += e["current_value"] or e["total_invested"] or 0

    total_pl = sum(e["profit_loss"] for e in enriched if e["profit_loss"] is not None)
    return {
        "total_invested": total_invested,
        "total_current_value": total_current,
        "profit_loss": total_pl,
        "profit_loss_pct": (total_pl / total_invested * 100) if total_invested > 0 else 0,
        "by_type": by_type,
        "positions": enriched,
    }


# === Binance Integration ===

@router.get("/binance/status", response_model=BinanceConfigResponse)
async def binance_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_binance_status(db, current_user.id)


@router.post("/binance/config", response_model=BinanceConfigResponse)
async def configure_binance(
    data: BinanceConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await test_connection(data.api_key, data.api_secret)
    except BinanceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao conectar na Binance: {str(e)}")

    config = db.query(APIConfig).filter(
        APIConfig.user_id == current_user.id,
        APIConfig.service == "binance",
    ).first()
    if config:
        config.set_credentials(data.api_key, data.api_secret)
        config.is_active = True
    else:
        config = APIConfig(user_id=current_user.id, service="binance")
        config.set_credentials(data.api_key, data.api_secret)
        db.add(config)

    db.commit()
    db.refresh(config)
    return await get_binance_status(db, current_user.id)


@router.delete("/binance/config")
async def remove_binance_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = db.query(APIConfig).filter(
        APIConfig.user_id == current_user.id,
        APIConfig.service == "binance",
    ).first()
    if config:
        db.delete(config)
        db.commit()
    return {"ok": True}


@router.post("/binance/sync", response_model=BinanceSyncResponse)
async def sync_binance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await sync_binance_investments(db, current_user.id)
    except BinanceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao sincronizar: {str(e)}")


# === Investment Deposits ===

def _get_owned_investment(db: Session, user_id: int, investment_id: int) -> Investment:
    inv = db.query(Investment).filter(
        Investment.id == investment_id,
        Investment.user_id == user_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    return inv


@router.get("/{investment_id}/deposits", response_model=list[InvestmentDepositResponse])
async def list_deposits(
    investment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = _get_owned_investment(db, current_user.id, investment_id)
    return sorted(inv.deposits, key=lambda d: d.deposit_date)


@router.post("/{investment_id}/deposits", response_model=InvestmentDepositResponse)
async def create_deposit(
    investment_id: int,
    data: InvestmentDepositCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_investment(db, current_user.id, investment_id)
    deposit = InvestmentDeposit(
        user_id=current_user.id,
        investment_id=investment_id,
        amount=data.amount,
        deposit_date=data.deposit_date,
    )
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


@router.put("/{investment_id}/deposits/{deposit_id}", response_model=InvestmentDepositResponse)
async def update_deposit(
    investment_id: int,
    deposit_id: int,
    data: InvestmentDepositCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deposit = db.query(InvestmentDeposit).filter(
        InvestmentDeposit.id == deposit_id,
        InvestmentDeposit.investment_id == investment_id,
        InvestmentDeposit.user_id == current_user.id,
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    deposit.amount = data.amount
    deposit.deposit_date = data.deposit_date
    db.commit()
    db.refresh(deposit)
    return deposit


@router.delete("/{investment_id}/deposits/{deposit_id}")
async def delete_deposit(
    investment_id: int,
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deposit = db.query(InvestmentDeposit).filter(
        InvestmentDeposit.id == deposit_id,
        InvestmentDeposit.investment_id == investment_id,
        InvestmentDeposit.user_id == current_user.id,
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    db.delete(deposit)
    db.commit()
    return {"ok": True}


# === Investment Redemptions ===

@router.get("/{investment_id}/redemptions", response_model=list[InvestmentRedemptionResponse])
async def list_redemptions(
    investment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = _get_owned_investment(db, current_user.id, investment_id)
    return sorted(inv.redemptions, key=lambda r: r.redemption_date)


@router.post("/{investment_id}/redemptions", response_model=InvestmentRedemptionResponse)
async def create_redemption(
    investment_id: int,
    data: InvestmentRedemptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_investment(db, current_user.id, investment_id)
    redemption = InvestmentRedemption(
        user_id=current_user.id,
        investment_id=investment_id,
        amount=data.amount,
        redemption_date=data.redemption_date,
    )
    db.add(redemption)
    db.commit()
    db.refresh(redemption)
    return redemption


@router.put("/{investment_id}/redemptions/{redemption_id}", response_model=InvestmentRedemptionResponse)
async def update_redemption(
    investment_id: int,
    redemption_id: int,
    data: InvestmentRedemptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    redemption = db.query(InvestmentRedemption).filter(
        InvestmentRedemption.id == redemption_id,
        InvestmentRedemption.investment_id == investment_id,
        InvestmentRedemption.user_id == current_user.id,
    ).first()
    if not redemption:
        raise HTTPException(status_code=404, detail="Resgate não encontrado")
    redemption.amount = data.amount
    redemption.redemption_date = data.redemption_date
    db.commit()
    db.refresh(redemption)
    return redemption


@router.delete("/{investment_id}/redemptions/{redemption_id}")
async def delete_redemption(
    investment_id: int,
    redemption_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    redemption = db.query(InvestmentRedemption).filter(
        InvestmentRedemption.id == redemption_id,
        InvestmentRedemption.investment_id == investment_id,
        InvestmentRedemption.user_id == current_user.id,
    ).first()
    if not redemption:
        raise HTTPException(status_code=404, detail="Resgate não encontrado")
    db.delete(redemption)
    db.commit()
    return {"ok": True}


# === Stock Transactions ===

@router.get("/{investment_id}/stock-transactions", response_model=list[StockTransactionResponse])
async def list_stock_transactions(
    investment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = _get_owned_investment(db, current_user.id, investment_id)
    return sorted(inv.stock_transactions, key=lambda t: t.date)


@router.post("/{investment_id}/stock-transactions", response_model=StockTransactionResponse)
async def create_stock_transaction(
    investment_id: int,
    data: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = _get_owned_investment(db, current_user.id, investment_id)
    if inv.type not in STOCK_TYPES:
        raise HTTPException(status_code=400, detail="Movimentações de ações só são permitidas para FII, ACAO_BR e ACAO_GLOBAL")

    tx = StockTransaction(
        user_id=current_user.id,
        investment_id=investment_id,
        type=data.type,
        quantity=data.quantity,
        price_per_share=data.price_per_share,
        date=data.date,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.put("/{investment_id}/stock-transactions/{tx_id}", response_model=StockTransactionResponse)
async def update_stock_transaction(
    investment_id: int,
    tx_id: int,
    data: StockTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(StockTransaction).filter(
        StockTransaction.id == tx_id,
        StockTransaction.investment_id == investment_id,
        StockTransaction.user_id == current_user.id,
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    tx.type = data.type
    tx.quantity = data.quantity
    tx.price_per_share = data.price_per_share
    tx.date = data.date
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{investment_id}/stock-transactions/{tx_id}")
async def delete_stock_transaction(
    investment_id: int,
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(StockTransaction).filter(
        StockTransaction.id == tx_id,
        StockTransaction.investment_id == investment_id,
        StockTransaction.user_id == current_user.id,
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    db.delete(tx)
    db.commit()
    return {"ok": True}
