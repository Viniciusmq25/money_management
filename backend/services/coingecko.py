import httpx
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from models.quote_cache import QuoteCache
from config import get_settings

settings = get_settings()

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# Mapping of common tickers to CoinGecko IDs
TICKER_TO_ID = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "ADA": "cardano",
    "DOT": "polkadot",
    "AVAX": "avalanche-2",
    "MATIC": "matic-network",
    "LINK": "chainlink",
    "UNI": "uniswap",
    "XRP": "ripple",
    "BNB": "binancecoin",
    "DOGE": "dogecoin",
    "SHIB": "shiba-inu",
    "LTC": "litecoin",
    "ATOM": "cosmos",
}


def _get_coin_id(ticker: str) -> str:
    return TICKER_TO_ID.get(ticker.upper(), ticker.lower())


async def get_crypto_prices(tickers: list[str], db: Session) -> dict:
    """Fetch crypto prices from CoinGecko with caching."""
    result = {}
    tickers_to_fetch = []

    # Check cache first
    for ticker in tickers:
        cached = db.query(QuoteCache).filter(
            QuoteCache.ticker == ticker.upper(),
            QuoteCache.asset_type == "CRYPTO",
        ).first()

        if cached and cached.fetched_at:
            age = (datetime.now(timezone.utc) - cached.fetched_at.replace(tzinfo=timezone.utc)).total_seconds()
            if age < settings.CACHE_TTL_CRYPTO:
                result[ticker.upper()] = {
                    "price": cached.price,
                    "change_24h": cached.change_24h,
                    "extra": cached.extra_data,
                }
                continue
        tickers_to_fetch.append(ticker)

    if not tickers_to_fetch:
        return result

    # Fetch from API
    coin_ids = [_get_coin_id(t) for t in tickers_to_fetch]
    ids_str = ",".join(coin_ids)

    params = {
        "ids": ids_str,
        "vs_currencies": "brl",
        "include_24hr_change": "true",
        "include_market_cap": "true",
    }
    if settings.COINGECKO_API_KEY:
        params["x_cg_demo_api_key"] = settings.COINGECKO_API_KEY

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{COINGECKO_BASE}/simple/price", params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return result

    # Map back to tickers and update cache
    id_to_ticker = {_get_coin_id(t): t.upper() for t in tickers_to_fetch}

    for coin_id, info in data.items():
        ticker = id_to_ticker.get(coin_id)
        if not ticker:
            continue

        price = info.get("brl", 0)
        change = info.get("brl_24h_change", 0)
        market_cap = info.get("brl_market_cap", 0)

        result[ticker] = {
            "price": price,
            "change_24h": round(change, 2) if change else 0,
            "extra": {"market_cap": market_cap},
        }

        # Upsert cache
        cached = db.query(QuoteCache).filter(
            QuoteCache.ticker == ticker,
            QuoteCache.asset_type == "CRYPTO",
        ).first()

        if cached:
            cached.price = price
            cached.change_24h = change
            cached.extra_data = {"market_cap": market_cap}
            cached.fetched_at = datetime.now(timezone.utc)
        else:
            db.add(QuoteCache(
                ticker=ticker,
                asset_type="CRYPTO",
                price=price,
                change_24h=change,
                extra_data={"market_cap": market_cap},
            ))

    db.commit()
    return result


async def get_crypto_history(coin_id: str, days: int = 30) -> list[dict]:
    """Fetch historical price data for a crypto."""
    params = {"vs_currency": "brl", "days": str(days)}
    if settings.COINGECKO_API_KEY:
        params["x_cg_demo_api_key"] = settings.COINGECKO_API_KEY

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{COINGECKO_BASE}/coins/{coin_id}/market_chart", params=params)
            resp.raise_for_status()
            data = resp.json()

        prices = data.get("prices", [])
        return [
            {"date": datetime.fromtimestamp(p[0] / 1000).strftime("%Y-%m-%d"), "price": p[1]}
            for p in prices
        ]
    except Exception:
        return []
