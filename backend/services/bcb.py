import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.quote_cache import QuoteCache
from config import get_settings

settings = get_settings()

BCB_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"

# Series codes
SELIC_DAILY = 11
CDI_DAILY = 12
SELIC_META = 432
IPCA_MONTHLY = 433


async def get_selic_cdi_rates(db: Session) -> dict:
    """Fetch Selic and CDI rates from BCB API with caching."""
    # Check cache
    cached_selic = db.query(QuoteCache).filter(
        QuoteCache.ticker == "SELIC",
        QuoteCache.asset_type == "RATE",
    ).first()

    cached_cdi = db.query(QuoteCache).filter(
        QuoteCache.ticker == "CDI",
        QuoteCache.asset_type == "RATE",
    ).first()

    now = datetime.now(timezone.utc)
    result = {}

    if cached_selic and cached_selic.fetched_at:
        age = (now - cached_selic.fetched_at.replace(tzinfo=timezone.utc)).total_seconds()
        if age < settings.CACHE_TTL_SELIC:
            result["selic_daily"] = cached_selic.price
            result["selic_annual"] = cached_selic.extra_data.get("annual", 0) if cached_selic.extra_data else 0

    if cached_cdi and cached_cdi.fetched_at:
        age = (now - cached_cdi.fetched_at.replace(tzinfo=timezone.utc)).total_seconds()
        if age < settings.CACHE_TTL_SELIC:
            result["cdi_daily"] = cached_cdi.price
            result["cdi_annual"] = cached_cdi.extra_data.get("annual", 0) if cached_cdi.extra_data else 0

    if "selic_daily" in result and "cdi_daily" in result:
        return result

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Fetch Selic daily rate
            if "selic_daily" not in result:
                resp = await client.get(f"{BCB_BASE}.{SELIC_DAILY}/dados/ultimos/1?formato=json")
                resp.raise_for_status()
                selic_data = resp.json()
                if selic_data:
                    selic_daily = float(selic_data[-1]["valor"])
                    result["selic_daily"] = selic_daily

            # Fetch Selic Meta (annual target)
            resp2 = await client.get(f"{BCB_BASE}.{SELIC_META}/dados/ultimos/1?formato=json")
            resp2.raise_for_status()
            selic_meta_data = resp2.json()
            selic_annual = float(selic_meta_data[-1]["valor"]) if selic_meta_data else 0
            result["selic_annual"] = selic_annual

            # Fetch CDI daily rate
            if "cdi_daily" not in result:
                resp3 = await client.get(f"{BCB_BASE}.{CDI_DAILY}/dados/ultimos/1?formato=json")
                resp3.raise_for_status()
                cdi_data = resp3.json()
                if cdi_data:
                    cdi_daily = float(cdi_data[-1]["valor"])
                    result["cdi_daily"] = cdi_daily
                    # Approximate annual CDI from daily
                    cdi_annual = ((1 + cdi_daily / 100) ** 252 - 1) * 100
                    result["cdi_annual"] = round(cdi_annual, 2)

    except Exception:
        result.setdefault("selic_daily", 0)
        result.setdefault("selic_annual", 0)
        result.setdefault("cdi_daily", 0)
        result.setdefault("cdi_annual", 0)
        return result

    # Update cache
    _upsert_rate_cache(db, "SELIC", result.get("selic_daily", 0), {"annual": result.get("selic_annual", 0)})
    _upsert_rate_cache(db, "CDI", result.get("cdi_daily", 0), {"annual": result.get("cdi_annual", 0)})
    try:
        db.commit()
    except Exception:
        db.rollback()

    return result


def _upsert_rate_cache(db: Session, ticker: str, price: float, extra: dict):
    """Upsert rate cache - query by ticker only since unique constraint is on ticker."""
    cached = db.query(QuoteCache).filter(
        QuoteCache.ticker == ticker,
    ).first()

    if cached:
        cached.asset_type = "RATE"
        cached.price = price
        cached.extra_data = extra
        cached.fetched_at = datetime.now(timezone.utc)
    else:
        db.add(QuoteCache(
            ticker=ticker,
            asset_type="RATE",
            price=price,
            extra_data=extra,
        ))


async def get_selic_history(months: int = 12) -> list[dict]:
    """Fetch Selic Meta history."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{BCB_BASE}.{SELIC_META}/dados/ultimos/{months}?formato=json")
            resp.raise_for_status()
            data = resp.json()
        return [{"date": item["data"], "value": float(item["valor"])} for item in data]
    except Exception:
        return []


async def get_ipca_history(months: int = 12) -> list[dict]:
    """Fetch IPCA history."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{BCB_BASE}.{IPCA_MONTHLY}/dados/ultimos/{months}?formato=json")
            resp.raise_for_status()
            data = resp.json()
        return [{"date": item["data"], "value": float(item["valor"])} for item in data]
    except Exception:
        return []
