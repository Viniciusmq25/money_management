from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class QuoteCache(Base):
    __tablename__ = "quote_cache"
    __table_args__ = (
        UniqueConstraint('ticker', 'asset_type', name='uq_ticker_asset_type'),
    )

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(30), nullable=False, index=True)
    asset_type = Column(String(20), nullable=False, index=True)  # CRYPTO, FII, ACAO_BR, ACAO_GLOBAL, RATE
    price = Column(Float, nullable=True)
    change_24h = Column(Float, nullable=True)
    extra_data = Column(JSON, nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
