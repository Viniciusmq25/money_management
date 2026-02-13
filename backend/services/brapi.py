import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.quote_cache import QuoteCache
from config import get_settings

settings = get_settings()

BRAPI_BASE = "https://brapi.dev/api"


async def get_fii_quotes(tickers: list[str], db: Session) -> dict:
    """Fetch FII/stock quotes from BrAPI with caching."""
    result = {}
    tickers_to_fetch = []

    for ticker in tickers:
        cached = db.query(QuoteCache).filter(
            QuoteCache.ticker == ticker.upper(),
            QuoteCache.asset_type == "FII",
        ).first()

        if cached and cached.fetched_at:
            age = (datetime.now(timezone.utc) - cached.fetched_at.replace(tzinfo=timezone.utc)).total_seconds()
            if age < settings.CACHE_TTL_FII:
                result[ticker.upper()] = {
                    "price": cached.price,
                    "change_24h": cached.change_24h,
                    "extra": cached.extra_data,
                }
                continue
        tickers_to_fetch.append(ticker.upper())

    if not tickers_to_fetch:
        return result

    for ticker in tickers_to_fetch:
        try:
            params = {}
            if settings.BRAPI_TOKEN:
                params["token"] = settings.BRAPI_TOKEN

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{BRAPI_BASE}/quote/{ticker}", params=params)
                resp.raise_for_status()
                data = resp.json()

            results_list = data.get("results", [])
            if not results_list:
                continue

            quote = results_list[0]
            price = quote.get("regularMarketPrice", 0)
            change = quote.get("regularMarketChangePercent", 0)
            extra = {
                "name": quote.get("longName", ""),
                "symbol": quote.get("symbol", ticker),
                "volume": quote.get("regularMarketVolume", 0),
                "previous_close": quote.get("regularMarketPreviousClose", 0),
                "day_high": quote.get("regularMarketDayHigh", 0),
                "day_low": quote.get("regularMarketDayLow", 0),
            }

            result[ticker] = {
                "price": price,
                "change_24h": round(change, 2) if change else 0,
                "extra": extra,
            }

            # Upsert cache (query by ticker AND asset_type)
            cached = db.query(QuoteCache).filter(
                QuoteCache.ticker == ticker,
                QuoteCache.asset_type == "FII",
            ).first()

            if cached:
                cached.price = price
                cached.change_24h = change
                cached.extra_data = extra
                cached.fetched_at = datetime.now(timezone.utc)
            else:
                db.add(QuoteCache(
                    ticker=ticker,
                    asset_type="FII",
                    price=price,
                    change_24h=change,
                    extra_data=extra,
                ))

            db.commit()
        except Exception:
            db.rollback()
            continue

    return result


async def get_stock_quotes(tickers: list[str], db: Session, asset_type: str = "ACAO_BR") -> dict:
    """Fetch stock quotes from BrAPI with caching (ACAO_BR or ACAO_GLOBAL)."""
    result = {}
    tickers_to_fetch = []

    for ticker in tickers:
        cached = db.query(QuoteCache).filter(
            QuoteCache.ticker == ticker.upper(),
            QuoteCache.asset_type == asset_type,
        ).first()

        if cached and cached.fetched_at:
            age = (datetime.now(timezone.utc) - cached.fetched_at.replace(tzinfo=timezone.utc)).total_seconds()
            if age < settings.CACHE_TTL_FII:  # Use same TTL as FII
                result[ticker.upper()] = {
                    "price": cached.price,
                    "change_24h": cached.change_24h,
                    "extra": cached.extra_data,
                }
                continue
        tickers_to_fetch.append(ticker.upper())

    if not tickers_to_fetch:
        return result

    for ticker in tickers_to_fetch:
        try:
            params = {}
            if settings.BRAPI_TOKEN:
                params["token"] = settings.BRAPI_TOKEN

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{BRAPI_BASE}/quote/{ticker}", params=params)
                resp.raise_for_status()
                data = resp.json()

            results_list = data.get("results", [])
            if not results_list:
                continue

            quote = results_list[0]
            price = quote.get("regularMarketPrice", 0)
            change = quote.get("regularMarketChangePercent", 0)
            extra = {
                "name": quote.get("longName", ""),
                "symbol": quote.get("symbol", ticker),
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

            # Upsert cache (query by ticker AND asset_type)
            cached = db.query(QuoteCache).filter(
                QuoteCache.ticker == ticker,
                QuoteCache.asset_type == asset_type,
            ).first()

            if cached:
                cached.price = price
                cached.change_24h = change
                cached.extra_data = extra
                cached.fetched_at = datetime.now(timezone.utc)
            else:
                db.add(QuoteCache(
                    ticker=ticker,
                    asset_type=asset_type,
                    price=price,
                    change_24h=change,
                    extra_data=extra,
                ))

            db.commit()
        except Exception:
            db.rollback()
            continue

    return result
