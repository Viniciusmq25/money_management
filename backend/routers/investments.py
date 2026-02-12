from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.investment import Investment, InvestmentType
from models.api_config import APIConfig
from schemas import InvestmentCreate, InvestmentUpdate, InvestmentResponse, BinanceConfigCreate, BinanceConfigResponse, BinanceSyncResponse
from services.coingecko import get_crypto_prices
from services.brapi import get_fii_quotes, get_stock_quotes
from services.bcb import get_selic_cdi_rates
from services.binance import sync_binance_investments, get_binance_status, test_connection, BinanceError

router = APIRouter(prefix="/api/investments", tags=["investments"], dependencies=[Depends(get_current_user)])


async def enrich_investment(inv: Investment, db: Session) -> dict:
    """Add current price and P&L data to an investment."""
    qty = inv.quantity or 0
    avg = inv.avg_price or 0

    data = {
        "id": inv.id,
        "type": inv.type,
        "ticker": inv.ticker,
        "name": inv.name,
        "quantity": inv.quantity,
        "avg_price": inv.avg_price,
        "purchase_date": inv.purchase_date,
        "rate_type": inv.rate_type,
        "rate_value": inv.rate_value,
        "maturity_date": inv.maturity_date,
        "created_at": inv.created_at,
        "total_invested": qty * avg,
        "current_price": None,
        "change_24h": None,
        "current_value": None,
        "profit_loss": None,
        "profit_loss_pct": None,
    }

    try:
        if inv.type == InvestmentType.CRYPTO:
            prices = await get_crypto_prices([inv.ticker], db)
            if inv.ticker in prices:
                p = prices[inv.ticker]
                data["current_price"] = p["price"]
                data["change_24h"] = p.get("change_24h")
                data["current_value"] = qty * p["price"]
        elif inv.type == InvestmentType.FII:
            quotes = await get_fii_quotes([inv.ticker], db)
            if inv.ticker in quotes:
                q = quotes[inv.ticker]
                data["current_price"] = q["price"]
                data["change_24h"] = q.get("change_24h")
                data["current_value"] = qty * q["price"]
        elif inv.type == InvestmentType.ACAO_BR:
            quotes = await get_stock_quotes([inv.ticker], db, asset_type="ACAO_BR")
            if inv.ticker in quotes:
                q = quotes[inv.ticker]
                data["current_price"] = q["price"]
                data["change_24h"] = q.get("change_24h")
                data["current_value"] = qty * q["price"]
        elif inv.type == InvestmentType.ACAO_GLOBAL:
            quotes = await get_stock_quotes([inv.ticker], db, asset_type="ACAO_GLOBAL")
            if inv.ticker in quotes:
                q = quotes[inv.ticker]
                data["current_price"] = q["price"]
                data["change_24h"] = q.get("change_24h")
                data["current_value"] = qty * q["price"]
        elif inv.type in (InvestmentType.RENDA_FIXA, InvestmentType.CAIXINHA_NUBANK, InvestmentType.CAIXINHA_TURBO_NUBANK):
            rates = await get_selic_cdi_rates(db)
            annual_rate = 0
            if inv.rate_type == "SELIC":
                annual_rate = rates.get("selic_annual", 0) * (inv.rate_value or 100) / 100
            elif inv.rate_type == "CDI":
                annual_rate = rates.get("cdi_annual", 0) * (inv.rate_value or 100) / 100
            elif inv.rate_type == "PREFIXADO":
                annual_rate = inv.rate_value or 0
            # Simplistic: estimate current value with annual rate
            if inv.purchase_date:
                from datetime import date
                days = (date.today() - inv.purchase_date).days
                daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                factor = (1 + daily_rate) ** min(days, days)
                data["current_price"] = avg * factor
                data["current_value"] = qty * avg * factor
    except Exception:
        pass

    if data["current_value"] and data["total_invested"]:
        data["profit_loss"] = data["current_value"] - data["total_invested"]
        if data["total_invested"] > 0:
            data["profit_loss_pct"] = (data["profit_loss"] / data["total_invested"]) * 100

    return data


@router.get("", response_model=list[InvestmentResponse])
async def list_investments(type: InvestmentType | None = None, db: Session = Depends(get_db)):
    query = db.query(Investment)
    if type:
        query = query.filter(Investment.type == type)
    investments = query.order_by(Investment.type, Investment.ticker).all()
    return [await enrich_investment(inv, db) for inv in investments]


@router.post("", response_model=InvestmentResponse)
async def create_investment(data: InvestmentCreate, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude={"applied_amount"})
    inv = Investment(**payload)
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return await enrich_investment(inv, db)


@router.put("/{id}", response_model=InvestmentResponse)
async def update_investment(id: int, data: InvestmentUpdate, db: Session = Depends(get_db)):
    inv = db.query(Investment).filter(Investment.id == id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(inv, key, val)
    db.commit()
    db.refresh(inv)
    return await enrich_investment(inv, db)


@router.delete("/{id}")
async def delete_investment(id: int, db: Session = Depends(get_db)):
    inv = db.query(Investment).filter(Investment.id == id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    db.delete(inv)
    db.commit()
    return {"ok": True}


@router.get("/summary")
async def investment_summary(db: Session = Depends(get_db)):
    investments = db.query(Investment).all()
    enriched = [await enrich_investment(inv, db) for inv in investments]

    by_type = {}
    total_invested = 0
    total_current = 0
    for e in enriched:
        t = e["type"].value if hasattr(e["type"], "value") else e["type"]
        if t not in by_type:
            by_type[t] = {"invested": 0, "current": 0, "count": 0}
        by_type[t]["invested"] += e["total_invested"] or 0
        by_type[t]["current"] += e["current_value"] or e["total_invested"] or 0
        by_type[t]["count"] += 1
        total_invested += e["total_invested"] or 0
        total_current += e["current_value"] or e["total_invested"] or 0

    return {
        "total_invested": total_invested,
        "total_current_value": total_current,
        "profit_loss": total_current - total_invested,
        "profit_loss_pct": ((total_current - total_invested) / total_invested * 100) if total_invested > 0 else 0,
        "by_type": by_type,
        "positions": enriched,
    }


# === Binance Integration ===
@router.get("/binance/status", response_model=BinanceConfigResponse)
async def binance_status(db: Session = Depends(get_db)):
    """Get current Binance API integration status."""
    return await get_binance_status(db)


@router.post("/binance/config", response_model=BinanceConfigResponse)
async def configure_binance(data: BinanceConfigCreate, db: Session = Depends(get_db)):
    """Configure Binance API credentials."""
    # Test connection first
    try:
        await test_connection(data.api_key, data.api_secret)
    except BinanceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao conectar na Binance: {str(e)}")
    
    # Check if config already exists
    config = db.query(APIConfig).filter(APIConfig.service == "binance").first()
    
    if config:
        config.set_credentials(data.api_key, data.api_secret)
        config.is_active = True
    else:
        config = APIConfig(service="binance")
        config.set_credentials(data.api_key, data.api_secret)
        db.add(config)
    
    db.commit()
    db.refresh(config)
    
    return await get_binance_status(db)


@router.delete("/binance/config")
async def remove_binance_config(db: Session = Depends(get_db)):
    """Remove Binance API configuration."""
    config = db.query(APIConfig).filter(APIConfig.service == "binance").first()
    if config:
        db.delete(config)
        db.commit()
    return {"ok": True}


@router.post("/binance/sync", response_model=BinanceSyncResponse)
async def sync_binance(db: Session = Depends(get_db)):
    """Sync investments from Binance account."""
    try:
        result = await sync_binance_investments(db)
        return result
    except BinanceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao sincronizar: {str(e)}")
