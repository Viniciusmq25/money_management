from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class QuoteCache(Base):
    __tablename__ = "quote_cache"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(30), unique=True, nullable=False, index=True)
    asset_type = Column(String(20), nullable=False)  # CRYPTO, FII, SELIC, CDI
    price = Column(Float, nullable=True)
    change_24h = Column(Float, nullable=True)
    extra_data = Column(JSON, nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
