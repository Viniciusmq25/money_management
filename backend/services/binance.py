"""
Binance API integration service.
Fetches account balances and converts them to investments.
"""
import httpx
import hmac
import hashlib
import time
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
from models.api_config import APIConfig
from models.investment import Investment, InvestmentType

BINANCE_BASE = "https://api.binance.com"


class BinanceError(Exception):
    """Custom exception for Binance API errors."""
    pass


def _sign_request(query_string: str, secret: str) -> str:
    """Create HMAC SHA256 signature for Binance API."""
    return hmac.new(
        secret.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


async def test_connection(api_key: str, api_secret: str) -> dict:
    """Test Binance API connection and return account info."""
    timestamp = int(time.time() * 1000)
    query_string = f"timestamp={timestamp}"
    signature = _sign_request(query_string, api_secret)
    
    url = f"{BINANCE_BASE}/api/v3/account?{query_string}&signature={signature}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            url,
            headers={"X-MBX-APIKEY": api_key}
        )
        
        if response.status_code != 200:
            error = response.json()
            raise BinanceError(f"Binance API error: {error.get('msg', 'Unknown error')}")
        
        return response.json()


async def get_account_balances(api_key: str, api_secret: str) -> list[dict]:
    """
    Fetch all non-zero balances from Binance account.
    Returns list of {asset, free, locked, total}.
    """
    account_info = await test_connection(api_key, api_secret)
    
    balances = []
    for balance in account_info.get("balances", []):
        free = float(balance["free"])
        locked = float(balance["locked"])
        total = free + locked
        
        if total > 0:
            balances.append({
                "asset": balance["asset"],
                "free": free,
                "locked": locked,
                "total": total,
            })
    
    return balances


async def get_all_tickers(api_key: str, api_secret: str) -> dict:
    """Fetch current prices for all trading pairs."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{BINANCE_BASE}/api/v3/ticker/price")
        
        if response.status_code != 200:
            return {}
        
        prices = {}
        for item in response.json():
            prices[item["symbol"]] = float(item["price"])
        
        return prices


async def get_avg_buy_price(api_key: str, api_secret: str, symbol: str) -> float | None:
    """
    Try to calculate average buy price from trade history.
    Returns None if unable to calculate.
    """
    timestamp = int(time.time() * 1000)
    query_string = f"symbol={symbol}&timestamp={timestamp}"
    signature = _sign_request(query_string, api_secret)
    
    url = f"{BINANCE_BASE}/api/v3/myTrades?{query_string}&signature={signature}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            url,
            headers={"X-MBX-APIKEY": api_key}
        )
        
        if response.status_code != 200:
            return None
        
        trades = response.json()
        
        # Calculate weighted average price for buys
        total_qty = 0
        total_cost = 0
        
        for trade in trades:
            if trade["isBuyer"]:
                qty = float(trade["qty"])
                price = float(trade["price"])
                total_qty += qty
                total_cost += qty * price
        
        if total_qty > 0:
            return total_cost / total_qty
        
        return None


async def sync_binance_investments(db: Session, user_id: int) -> dict:
    """
    Sync Binance account balances to investments for a specific user.
    Returns summary of changes.
    """
    # Get API config for this user
    config = db.query(APIConfig).filter(
        APIConfig.user_id == user_id,
        APIConfig.service == "binance",
        APIConfig.is_active == True
    ).first()
    
    if not config:
        raise BinanceError("Binance API não configurada. Configure suas credenciais primeiro.")
    
    api_key, api_secret = config.get_credentials()
    
    # Fetch balances
    balances = await get_account_balances(api_key, api_secret)
    
    # Fetch current prices to calculate BRL values
    prices = await get_all_tickers(api_key, api_secret)
    
    # Get USDT/BRL rate (approximate via BTCUSDT and BTCBRL if available)
    usdt_brl = 5.0  # fallback
    if "USDTBRL" in prices:
        usdt_brl = prices["USDTBRL"]
    
    created = 0
    updated = 0
    skipped = 0
    details = []
    
    # Stablecoins and fiat to skip or handle specially
    stablecoins = {"USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD", "BRL", "USD", "EUR"}
    
    for balance in balances:
        asset = balance["asset"]
        total = balance["total"]
        
        # Skip dust (very small amounts)
        if total < 0.00000001:
            skipped += 1
            continue
        
        # Calculate BRL value
        brl_value = 0
        avg_price_brl = 0
        
        if asset in stablecoins:
            if asset == "BRL":
                brl_value = total
                avg_price_brl = 1.0
            elif asset in {"USDT", "USDC", "BUSD", "FDUSD"}:
                brl_value = total * usdt_brl
                avg_price_brl = usdt_brl
            else:
                # Skip other stablecoins for now
                skipped += 1
                continue
        else:
            # Try to get price via USDT pair
            usdt_symbol = f"{asset}USDT"
            brl_symbol = f"{asset}BRL"
            
            if brl_symbol in prices:
                avg_price_brl = prices[brl_symbol]
                brl_value = total * avg_price_brl
            elif usdt_symbol in prices:
                avg_price_brl = prices[usdt_symbol] * usdt_brl
                brl_value = total * avg_price_brl
            else:
                # Can't determine price, skip
                skipped += 1
                continue
        
        # Check if investment already exists for this user
        existing = db.query(Investment).filter(
            Investment.user_id == user_id,
            Investment.type == InvestmentType.CRYPTO,
            Investment.ticker == asset
        ).first()
        
        if existing:
            # Update quantity only if changed significantly
            if abs(existing.quantity - total) > 0.00000001:
                existing.quantity = total
                # Try to get average buy price from trade history
                try:
                    usdt_symbol = f"{asset}USDT"
                    historical_avg = await get_avg_buy_price(api_key, api_secret, usdt_symbol)
                    if historical_avg:
                        existing.avg_price = historical_avg * usdt_brl
                except Exception as e:
                    logger.debug(f"Could not fetch avg buy price for {asset}: {e}")
                updated += 1
                details.append(f"Atualizado: {asset} = {total:.8f}")
        else:
            # Create new investment
            new_inv = Investment(
                user_id=user_id,
                type=InvestmentType.CRYPTO,
                ticker=asset,
                name=f"{asset} (Binance)",
                quantity=total,
                avg_price=avg_price_brl,
            )
            db.add(new_inv)
            created += 1
            details.append(f"Criado: {asset} = {total:.8f}")
    
    # Update last sync time
    config.last_sync = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_assets": len(balances),
        "details": details,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_binance_status(db: Session, user_id: int) -> dict:
    """Get current Binance integration status for a user."""
    config = db.query(APIConfig).filter(
        APIConfig.user_id == user_id,
        APIConfig.service == "binance"
    ).first()
    
    if not config:
        return {
            "configured": False,
            "active": False,
            "last_sync": None,
        }
    
    return {
        "configured": True,
        "active": config.is_active,
        "last_sync": config.last_sync.isoformat() if config.last_sync else None,
        "created_at": config.created_at.isoformat() if config.created_at else None,
    }
