from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from database import Base
import enum


class CategoryType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    icon = Column(String(50), default="circle")
    color = Column(String(7), default="#6C63FF")
    type = Column(SAEnum(CategoryType), nullable=False)
    budget_limit = Column(Float, nullable=True)
    exclude_from_reports = Column(Boolean, nullable=False, server_default="false", default=False)

    transactions = relationship("Transaction", back_populates="category")
