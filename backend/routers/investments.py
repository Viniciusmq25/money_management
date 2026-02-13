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
    is_caixinha = inv.type in (InvestmentType.CAIXINHA_NUBANK, InvestmentType.CAIXINHA_TURBO_NUBANK)
    
    # Para caixinhas: original_amount é o investido, quantity é o valor atual
    if is_caixinha:
        total_invested = inv.original_amount if inv.original_amount else qty * avg
        current_value = qty * avg  # quantity representa o valor atual
    else:
        total_invested = qty * avg
        current_value = None

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
        "original_amount": inv.original_amount,
        "created_at": inv.created_at,
        "total_invested": total_invested,
        "current_price": None,
        "change_24h": None,
        "current_value": current_value,
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
        elif inv.type == InvestmentType.RENDA_FIXA:
            # Para renda fixa normal, calcular baseado na taxa
            rates = await get_selic_cdi_rates(db)
            annual_rate = 0
            if inv.rate_type == "SELIC":
                annual_rate = rates.get("selic_annual", 0) * (inv.rate_value or 100) / 100
            elif inv.rate_type == "CDI":
                annual_rate = rates.get("cdi_annual", 0) * (inv.rate_value or 100) / 100
            elif inv.rate_type == "PREFIXADO":
                annual_rate = inv.rate_value or 0
            if inv.purchase_date:
                from datetime import date
                days = (date.today() - inv.purchase_date).days
                daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                factor = (1 + daily_rate) ** min(days, days)
                data["current_price"] = avg * factor
                data["current_value"] = qty * avg * factor
        # Para caixinhas, o current_value já foi definido acima (é o quantity * avg_price)
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
    # Verifica se já existe investimento do mesmo ticker e tipo para consolidar
    existing = db.query(Investment).filter(
        Investment.ticker == data.ticker.upper(),
        Investment.type == data.type
    ).first()
    
    if existing:
        # Calcula novo preço médio ponderado
        old_total = (existing.quantity or 0) * (existing.avg_price or 0)
        new_total = (data.quantity or 0) * (data.avg_price or 0)
        new_quantity = (existing.quantity or 0) + (data.quantity or 0)
        new_avg_price = (old_total + new_total) / new_quantity if new_quantity > 0 else 0
        
        # Atualiza posição existente
        existing.quantity = new_quantity
        existing.avg_price = new_avg_price
        # Mantém a data de compra mais antiga
        if data.purchase_date and (not existing.purchase_date or data.purchase_date < existing.purchase_date):
            existing.purchase_date = data.purchase_date
        
        db.commit()
        db.refresh(existing)
        return await enrich_investment(existing, db)
    
    # Se não existe, cria novo
    payload = data.model_dump(exclude={"applied_amount"})
    payload["ticker"] = payload["ticker"].upper()
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


@router.post("/consolidate")
async def consolidate_positions(db: Session = Depends(get_db)):
    """Consolidate duplicate positions (same ticker + type) into single entries."""
    from sqlalchemy import func
    
    # Find duplicates: group by ticker + type where count > 1
    duplicates = db.query(
        Investment.ticker, Investment.type
    ).group_by(
        Investment.ticker, Investment.type
    ).having(
        func.count(Investment.id) > 1
    ).all()
    
    consolidated_count = 0
    
    for ticker, inv_type in duplicates:
        # Get all positions for this ticker/type
        positions = db.query(Investment).filter(
            Investment.ticker == ticker,
            Investment.type == inv_type
        ).order_by(Investment.purchase_date.asc().nullslast()).all()
        
        if len(positions) < 2:
            continue
        
        # Keep the first (oldest) position and merge others into it
        main = positions[0]
        total_value = sum((p.quantity or 0) * (p.avg_price or 0) for p in positions)
        total_qty = sum(p.quantity or 0 for p in positions)
        new_avg = total_value / total_qty if total_qty > 0 else 0
        
        # Update main position
        main.quantity = total_qty
        main.avg_price = new_avg
        # Keep earliest purchase date
        for p in positions:
            if p.purchase_date and (not main.purchase_date or p.purchase_date < main.purchase_date):
                main.purchase_date = p.purchase_date
        
        # Delete duplicates (all except main)
        for p in positions[1:]:
            db.delete(p)
            consolidated_count += 1
    
    db.commit()
    
    return {
        "ok": True,
        "consolidated": consolidated_count,
        "message": f"{consolidated_count} posições duplicadas foram consolidadas"
    }
