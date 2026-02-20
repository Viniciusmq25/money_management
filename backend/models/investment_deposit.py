from sqlalchemy import Column, Integer, Float, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class InvestmentDeposit(Base):
    __tablename__ = "investment_deposits"

    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # valor aplicado
    deposit_date = Column(Date, nullable=False)  # data do aporte
    created_at = Column(DateTime(timezone=True), server_default=func.now())
