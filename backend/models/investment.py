from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum as SAEnum
from sqlalchemy.sql import func
from database import Base
import enum


class InvestmentType(str, enum.Enum):
    CRYPTO = "CRYPTO"
    FII = "FII"
    RENDA_FIXA = "RENDA_FIXA"
    ACAO_BR = "ACAO_BR"
    ACAO_GLOBAL = "ACAO_GLOBAL"


class Investment(Base):
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SAEnum(InvestmentType), nullable=False)
    ticker = Column(String(20), nullable=False)
    name = Column(String(150), nullable=False)
    quantity = Column(Float, nullable=False, default=0)
    avg_price = Column(Float, nullable=False, default=0)
    purchase_date = Column(Date, nullable=True)
    # For renda fixa
    rate_type = Column(String(20), nullable=True)  # CDI, SELIC, PREFIXADO, IPCA+
    rate_value = Column(Float, nullable=True)  # e.g., 100 (100% CDI), 12.5 (12.5% a.a.)
    maturity_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
