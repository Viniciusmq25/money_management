import httpx
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.quote_cache import QuoteCache
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

BRAPI_BASE = "https://brapi.dev/api"


async def get_brapi_quotes(tickers: list[str], db: Session, asset_type: str = "FII") -> dict:
    """Fetch quotes from BrAPI with batched cache lookup and single HTTP request."""
    if not tickers:
        return {}

    upper_tickers = [t.upper() for t in tickers]
    result = {}
    tickers_to_fetch = []

    # Batch cache lookup
    cached_rows = db.query(QuoteCache).filter(
        QuoteCache.ticker.in_(upper_tickers),
        QuoteCache.asset_type == asset_type,
    ).all()
    cached_map = {c.ticker: c for c in cached_rows}

    now = datetime.now(timezone.utc)
    for ticker in upper_tickers:
        cached = cached_map.get(ticker)
        if cached and cached.fetched_at:
            age = (now - cached.fetched_at.replace(tzinfo=timezone.utc)).total_seconds()
            if age < settings.CACHE_TTL_FII:
                result[ticker] = {
                    "price": cached.price,
                    "change_24h": cached.change_24h,
                    "extra": cached.extra_data,
                }
                continue
        tickers_to_fetch.append(ticker)

    if not tickers_to_fetch:
        return result

    # Single batch HTTP request with comma-separated tickers
    try:
        params = {}
        if settings.BRAPI_TOKEN:
            params["token"] = settings.BRAPI_TOKEN

        joined = ",".join(tickers_to_fetch)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{BRAPI_BASE}/quote/{joined}", params=params)
            resp.raise_for_status()
            data = resp.json()

        for quote in data.get("results", []):
            ticker = quote.get("symbol", "").upper()
            if ticker not in tickers_to_fetch:
                continue

            price = quote.get("regularMarketPrice", 0)
            change = quote.get("regularMarketChangePercent", 0)
            extra = {
                "name": quote.get("longName", ""),
                "symbol": ticker,
                "volume": quote.get("regularMarketVolume", 0),
                "previous_close": quote.get("regularMarketPreviousClose", 0),
                "day_high": quote.get("regularMarketDayHigh", 0),
                "day_low": quote.get("regularMarketDayLow", 0),
                "currency": quote.get("currency", "BRL"),
            }

            result[ticker] = {
                "price": price,
                "change_24h": round(change, 2) if change else 0,
                "extra": extra,
            }

            # Upsert cache
            cached = cached_map.get(ticker)
            if cached:
                cached.price = price
                cached.change_24h = change
                cached.extra_data = extra
                cached.fetched_at = now
            else:
                db.add(QuoteCache(
                    ticker=ticker,
                    asset_type=asset_type,
                    price=price,
                    change_24h=change,
                    extra_data=extra,
                ))

        db.commit()
    except Exception as e:
        logger.error(f"BrAPI batch fetch failed for {asset_type}: {e}", exc_info=True)
        db.rollback()

    return result


# Convenience wrappers
async def get_fii_quotes(tickers: list[str], db: Session) -> dict:
    return await get_brapi_quotes(tickers, db, asset_type="FII")


async def get_stock_quotes(tickers: list[str], db: Session, asset_type: str = "ACAO_BR") -> dict:
    return await get_brapi_quotes(tickers, db, asset_type=asset_type)
