from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from models.category import CategoryType
from models.transaction import TransactionType, TransactionSource
from models.investment import InvestmentType


# === Auth ===
class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# === Category ===
class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    icon: str = "circle"
    color: str = "#6C63FF"
    type: CategoryType
    budget_limit: Optional[float] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    budget_limit: Optional[float] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    icon: str
    color: str
    type: CategoryType
    budget_limit: Optional[float]

    class Config:
        from_attributes = True


# === Transaction ===
class TransactionCreate(BaseModel):
    type: TransactionType
    amount: float = Field(..., gt=0)
    description: str = Field(..., max_length=255)
    date: date
    category_id: Optional[int] = None


class TransactionUpdate(BaseModel):
    type: TransactionType
    amount: float = Field(..., gt=0)
    description: str = Field(..., max_length=255)
    date: date
    category_id: Optional[int] = None


class TransactionResponse(BaseModel):
    id: int
    type: TransactionType
    amount: float
    description: str
    date: date
    category_id: Optional[int]
    category: Optional[CategoryResponse] = None
    source: TransactionSource
    fit_id: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# === Investment ===
class InvestmentCreate(BaseModel):
    type: InvestmentType
    ticker: str = Field(..., max_length=20)
    name: str = Field(..., max_length=150)
    quantity: Optional[float] = Field(default=None, ge=0)
    avg_price: Optional[float] = Field(default=None, ge=0)
    purchase_date: Optional[date] = None
    rate_type: Optional[str] = None
    rate_value: Optional[float] = None
    maturity_date: Optional[date] = None
    # For caixinha: current value (quantity) and original amount applied
    applied_amount: Optional[float] = Field(default=None, ge=0)
    original_amount: Optional[float] = Field(default=None, ge=0)  # quanto foi realmente investido


class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    avg_price: Optional[float] = None
    purchase_date: Optional[date] = None
    rate_type: Optional[str] = None
    rate_value: Optional[float] = None
    maturity_date: Optional[date] = None
    original_amount: Optional[float] = None


class InvestmentResponse(BaseModel):
    id: int
    type: InvestmentType
    ticker: str
    name: str
    quantity: Optional[float] = None
    avg_price: Optional[float] = None
    purchase_date: Optional[date]
    rate_type: Optional[str]
    rate_value: Optional[float]
    maturity_date: Optional[date]
    original_amount: Optional[float] = None
    created_at: Optional[datetime]
    # Enriched fields (from API)
    current_price: Optional[float] = None
    change_24h: Optional[float] = None
    total_invested: Optional[float] = None
    current_value: Optional[float] = None
    profit_loss: Optional[float] = None
    profit_loss_pct: Optional[float] = None

    class Config:
        from_attributes = True


# === Goal ===
class GoalCreate(BaseModel):
    name: str = Field(..., max_length=150)
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0, ge=0)
    deadline: Optional[date] = None
    icon: str = "target"
    color: str = "#6C63FF"


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[date] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class GoalResponse(BaseModel):
    id: int
    name: str
    target_amount: float
    current_amount: float
    deadline: Optional[date]
    icon: str
    color: str
    progress: Optional[float] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# === Import ===
class ImportPreviewTransaction(BaseModel):
    date: date
    amount: float
    description: str
    type: TransactionType
    fit_id: Optional[str] = None
    suggested_category: Optional[str] = None
    is_duplicate: bool = False


class ImportPreviewResponse(BaseModel):
    filename: str
    bank: Optional[str]
    date_start: Optional[date]
    date_end: Optional[date]
    transactions: list[ImportPreviewTransaction]
    total_income: float
    total_expense: float
    duplicates_count: int


class ImportConfirmRequest(BaseModel):
    filename: str
    bank: Optional[str] = None
    transactions: list[ImportPreviewTransaction]


# === Dashboard ===
class DashboardSummary(BaseModel):
    balance: float
    total_income: float
    total_expense: float
    total_invested: float
    total_current_value: float
    investment_change_pct: float
    monthly_trend: list[dict]
    expense_by_category: list[dict]
    recent_transactions: list[TransactionResponse]
    market_data: dict


# === Binance Integration ===
class BinanceConfigCreate(BaseModel):
    api_key: str = Field(..., min_length=10, description="Binance API Key")
    api_secret: str = Field(..., min_length=10, description="Binance API Secret")


class BinanceConfigResponse(BaseModel):
    configured: bool
    active: bool
    last_sync: Optional[datetime] = None
    created_at: Optional[datetime] = None


class BinanceSyncResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    total_assets: int
    details: list[str]
    synced_at: str
