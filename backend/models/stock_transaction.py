from sqlalchemy import Column, Integer, Float, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(SAEnum("COMPRA", "VENDA", name="stocktransactiontype"), nullable=False)
    quantity = Column(Float, nullable=False)
    price_per_share = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    investment = relationship("Investment", back_populates="stock_transactions")
