from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
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
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(SAEnum(InvestmentType), nullable=False)
    ticker = Column(String(20), nullable=False)
    name = Column(String(150), nullable=False)
    quantity = Column(Float, nullable=False, default=0)  # units owned (market assets)
    avg_price = Column(Float, nullable=False, default=0)  # avg buy price (market assets)
    # For renda fixa
    rate_type = Column(String(20), nullable=True)
    rate_value = Column(Float, nullable=True)
    maturity_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deposits = relationship("InvestmentDeposit", back_populates="investment", cascade="all, delete-orphan", lazy="selectin")
    redemptions = relationship("InvestmentRedemption", back_populates="investment", cascade="all, delete-orphan", lazy="selectin")
    stock_transactions = relationship("StockTransaction", back_populates="investment", cascade="all, delete-orphan", lazy="selectin")
