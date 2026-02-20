from sqlalchemy import Column, Integer, Float, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class InvestmentRedemption(Base):
    __tablename__ = "investment_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # valor resgatado
    redemption_date = Column(Date, nullable=False)  # data do resgate
    created_at = Column(DateTime(timezone=True), server_default=func.now())
