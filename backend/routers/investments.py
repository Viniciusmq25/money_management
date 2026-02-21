from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.investment import Investment, InvestmentType
from models.investment_deposit import InvestmentDeposit
from models.investment_redemption import InvestmentRedemption
from models.api_config import APIConfig
from schemas import InvestmentCreate, InvestmentUpdate, InvestmentResponse, InvestmentDepositCreate, InvestmentDepositResponse, InvestmentRedemptionCreate, InvestmentRedemptionResponse, BinanceConfigCreate, BinanceConfigResponse, BinanceSyncResponse
from services.coingecko import get_crypto_prices
from services.brapi import get_fii_quotes, get_stock_quotes
from services.bcb import get_selic_cdi_rates
from services.binance import sync_binance_investments, get_binance_status, test_connection, BinanceError
import logging
from datetime import date

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/investments", tags=["investments"], dependencies=[Depends(get_current_user)])


async def enrich_investment(inv: Investment, db: Session) -> dict:
    """Add current price and P&L data to an investment."""
    qty = inv.quantity or 0
    avg = inv.avg_price or 0
    
    # RENDA_FIXA suporta depósitos/resgates (modelo caixinha) se houver movimentações registradas
    has_deposits = False
    total_invested = 0
    current_value = None
    
    if inv.type == InvestmentType.RENDA_FIXA:
        # Busca todos os deposits e redemptions desta RENDA_FIXA
        deposits = db.query(InvestmentDeposit).filter(InvestmentDeposit.investment_id == inv.id).order_by(InvestmentDeposit.deposit_date).all()
        redemptions = db.query(InvestmentRedemption).filter(InvestmentRedemption.investment_id == inv.id).order_by(InvestmentRedemption.redemption_date).all()
        
        if deposits or redemptions:
            has_deposits = True
            # Cálculo com deposits e resgates
            total_invested = sum(d.amount for d in deposits) - sum(r.amount for r in redemptions)
            current_value = await _calculate_caixinha_value(deposits, redemptions, inv, db)
        else:
            # RENDA_FIXA sem depósitos: fallback para original_amount ou qty * avg
            total_invested = inv.original_amount if inv.original_amount else qty * avg
            current_value = None  # Será calculado abaixo com base na taxa
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
        elif inv.type == InvestmentType.RENDA_FIXA and not has_deposits:
            # Calcular rendimento baseado na taxa CDI/SELIC/Prefixado (apenas se não usar sistema de depósitos)
            if inv.purchase_date:
                rates = await get_selic_cdi_rates(db)
                annual_rate = 0
                if inv.rate_type == "SELIC":
                    annual_rate = rates.get("selic_annual", 0) * (inv.rate_value or 100) / 100
                elif inv.rate_type == "CDI":
                    annual_rate = rates.get("cdi_annual", 0) * (inv.rate_value or 100) / 100
                elif inv.rate_type == "PREFIXADO":
                    annual_rate = inv.rate_value or 0
                
                if annual_rate > 0:
                    days = (date.today() - inv.purchase_date).days
                    if days > 0:
                        daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                        factor = (1 + daily_rate) ** days
                        data["current_price"] = avg * factor
                        data["current_value"] = qty * avg * factor
    except Exception as e:
        logger.error(f"Erro ao enriquecer investimento {inv.id} ({inv.ticker}): {str(e)}", exc_info=True)

    if data["current_value"] and data["total_invested"]:
        data["profit_loss"] = data["current_value"] - data["total_invested"]
        if data["total_invested"] > 0:
            data["profit_loss_pct"] = (data["profit_loss"] / data["total_invested"]) * 100

    return data


async def _calculate_caixinha_value(deposits: list[InvestmentDeposit], redemptions: list[InvestmentRedemption], inv: Investment, db: Session) -> float:
    """Calculate caixinha current value based on deposits and redemptions with CDI growth."""
    net_deposits = sum(d.amount for d in deposits) - sum(r.amount for r in redemptions)
    if not deposits and not redemptions:
        return 0
    if not inv.rate_type or not inv.rate_value:
        return net_deposits
    
    try:
        rates = await get_selic_cdi_rates(db)
        annual_rate = 0
        if inv.rate_type == "SELIC":
            annual_rate = rates.get("selic_annual", 0) * (inv.rate_value or 100) / 100
        elif inv.rate_type == "CDI":
            annual_rate = rates.get("cdi_annual", 0) * (inv.rate_value or 100) / 100
        elif inv.rate_type == "PREFIXADO":
            annual_rate = inv.rate_value or 0
        
        if annual_rate <= 0:
            return net_deposits
        
        total_value = 0
        today = date.today()
        
        # Calcula o valor de cada aporte com seu respectivo rendimento
        for deposit in deposits:
            days = (today - deposit.deposit_date).days
            if days > 0:
                daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                factor = (1 + daily_rate) ** days
                total_value += deposit.amount * factor
            else:
                # Aporte futuro ou hoje
                total_value += deposit.amount
        
        # Subtrai o valor de cada resgate com seu respectivo rendimento projetado desde a data do resgate
        for redemption in redemptions:
            days = (today - redemption.redemption_date).days
            if days > 0:
                daily_rate = (1 + annual_rate / 100) ** (1 / 252) - 1
                factor = (1 + daily_rate) ** days
                total_value -= redemption.amount * factor
            else:
                total_value -= redemption.amount
                
        return total_value
    except Exception as e:
        logger.error(f"Erro ao calcular valor da caixinha {inv.id}: {str(e)}", exc_info=True)
        return net_deposits


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
        existing.quantity = new_quantity
        existing.avg_price = new_avg_price
        
        # Mantém a data de compra mais antiga
        if data.purchase_date and (not existing.purchase_date or data.purchase_date < existing.purchase_date):
            existing.purchase_date = data.purchase_date
        
        # Atualiza rate_type/rate_value se fornecido
        if data.rate_type:
            existing.rate_type = data.rate_type
        if data.rate_value:
            existing.rate_value = data.rate_value
        
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


# === Investment Deposits ===
@router.get("/{investment_id}/deposits", response_model=list[InvestmentDepositResponse])
async def list_deposits(investment_id: int, db: Session = Depends(get_db)):
    """List all deposits for an investment."""
    inv = db.query(Investment).filter(Investment.id == investment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    
    deposits = db.query(InvestmentDeposit).filter(InvestmentDeposit.investment_id == investment_id).order_by(InvestmentDeposit.deposit_date).all()
    return deposits


@router.post("/{investment_id}/deposits", response_model=InvestmentDepositResponse)
async def create_deposit(investment_id: int, data: InvestmentDepositCreate, db: Session = Depends(get_db)):
    """Add a deposit to an investment (for caixinhas with multiple contributions)."""
    inv = db.query(Investment).filter(Investment.id == investment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    
    is_caixinha = inv.type == InvestmentType.RENDA_FIXA
    if not is_caixinha:
        raise HTTPException(status_code=400, detail="Deposits só podem ser adicionados a investimentos de Renda Fixa")
    
    deposit = InvestmentDeposit(
        investment_id=investment_id,
        amount=data.amount,
        deposit_date=data.deposit_date
    )
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


@router.put("/{investment_id}/deposits/{deposit_id}", response_model=InvestmentDepositResponse)
async def update_deposit(investment_id: int, deposit_id: int, data: InvestmentDepositCreate, db: Session = Depends(get_db)):
    """Update a deposit."""
    deposit = db.query(InvestmentDeposit).filter(
        InvestmentDeposit.id == deposit_id,
        InvestmentDeposit.investment_id == investment_id
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    
    deposit.amount = data.amount
    deposit.deposit_date = data.deposit_date
    db.commit()
    db.refresh(deposit)
    return deposit


@router.delete("/{investment_id}/deposits/{deposit_id}")
async def delete_deposit(investment_id: int, deposit_id: int, db: Session = Depends(get_db)):
    """Delete a deposit."""
    deposit = db.query(InvestmentDeposit).filter(
        InvestmentDeposit.id == deposit_id,
        InvestmentDeposit.investment_id == investment_id
    ).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Aporte não encontrado")
    
    db.delete(deposit)
    db.commit()
    return {"ok": True}


# === Investment Redemptions ===
@router.get("/{investment_id}/redemptions", response_model=list[InvestmentRedemptionResponse])
async def list_redemptions(investment_id: int, db: Session = Depends(get_db)):
    """List all redemptions for an investment."""
    inv = db.query(Investment).filter(Investment.id == investment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    
    redemptions = db.query(InvestmentRedemption).filter(InvestmentRedemption.investment_id == investment_id).order_by(InvestmentRedemption.redemption_date).all()
    return redemptions


@router.post("/{investment_id}/redemptions", response_model=InvestmentRedemptionResponse)
async def create_redemption(investment_id: int, data: InvestmentRedemptionCreate, db: Session = Depends(get_db)):
    """Add a redemption to an investment."""
    inv = db.query(Investment).filter(Investment.id == investment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    
    is_caixinha = inv.type == InvestmentType.RENDA_FIXA
    if not is_caixinha:
        raise HTTPException(status_code=400, detail="Resgates suportados apenas em Renda Fixa por enquanto")
    
    redemption = InvestmentRedemption(
        investment_id=investment_id,
        amount=data.amount,
        redemption_date=data.redemption_date
    )
    db.add(redemption)
    db.commit()
    db.refresh(redemption)
    return redemption


@router.put("/{investment_id}/redemptions/{redemption_id}", response_model=InvestmentRedemptionResponse)
async def update_redemption(investment_id: int, redemption_id: int, data: InvestmentRedemptionCreate, db: Session = Depends(get_db)):
    """Update a redemption."""
    redemption = db.query(InvestmentRedemption).filter(
        InvestmentRedemption.id == redemption_id,
        InvestmentRedemption.investment_id == investment_id
    ).first()
    if not redemption:
        raise HTTPException(status_code=404, detail="Resgate não encontrado")
    
    redemption.amount = data.amount
    redemption.redemption_date = data.redemption_date
    db.commit()
    db.refresh(redemption)
    return redemption


@router.delete("/{investment_id}/redemptions/{redemption_id}")
async def delete_redemption(investment_id: int, redemption_id: int, db: Session = Depends(get_db)):
    """Delete a redemption."""
    redemption = db.query(InvestmentRedemption).filter(
        InvestmentRedemption.id == redemption_id,
        InvestmentRedemption.investment_id == investment_id
    ).first()
    if not redemption:
        raise HTTPException(status_code=404, detail="Resgate não encontrado")
    
    db.delete(redemption)
    db.commit()
    return {"ok": True}
