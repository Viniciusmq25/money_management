from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import date, datetime
from models.category import CategoryType
from models.transaction import TransactionType, TransactionSource
from models.investment import InvestmentType
import re


# === Auth ===
class LoginRequest(BaseModel):
    username: Optional[str] = None
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# === Admin / Users ===
USERNAME_PATTERN = r'^[a-z0-9]{4,}$'


class UserCreateAdmin(BaseModel):
    username: str = Field(..., max_length=50)
    password: str = Field(..., min_length=6)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(USERNAME_PATTERN, v):
            raise ValueError('Username deve ter 4+ caracteres, apenas letras minúsculas e números')
        return v


class UserResetPassword(BaseModel):
    new_password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# === Category ===
class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100, min_length=1)
    icon: str = Field(default="circle", max_length=50)
    color: str = Field(default="#6C63FF", pattern=r'^#[0-9A-Fa-f]{6}$')
    type: CategoryType
    budget_limit: Optional[float] = Field(default=None, ge=0)

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Nome não pode ser vazio')
        return v.strip()


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100, min_length=1)
    icon: Optional[str] = Field(default=None, max_length=50)
    color: Optional[str] = Field(default=None, pattern=r'^#[0-9A-Fa-f]{6}$')
    budget_limit: Optional[float] = Field(default=None, ge=0)

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and (not v or not v.strip()):
            raise ValueError('Nome não pode ser vazio')
        return v.strip() if v else None


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


# === Investment Deposit ===
class InvestmentDepositCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Valor do aporte")
    deposit_date: date = Field(..., description="Data do aporte")


class InvestmentDepositResponse(BaseModel):
    id: int
    investment_id: int
    amount: float
    deposit_date: date
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# === Investment Redemption ===
class InvestmentRedemptionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Valor do resgate")
    redemption_date: date = Field(..., description="Data do resgate")


class InvestmentRedemptionResponse(BaseModel):
    id: int
    investment_id: int
    amount: float
    redemption_date: date
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# === Stock Transaction ===
class StockTransactionCreate(BaseModel):
    type: Literal["COMPRA", "VENDA"]
    quantity: float = Field(..., gt=0)
    price_per_share: float = Field(..., gt=0)
    date: date


class StockTransactionResponse(BaseModel):
    id: int
    investment_id: int
    type: str
    quantity: float
    price_per_share: float
    date: date
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# === Investment ===
class InvestmentCreate(BaseModel):
    type: InvestmentType
    ticker: str = Field(..., max_length=20, min_length=1)
    name: str = Field(..., max_length=150, min_length=1)
    quantity: Optional[float] = Field(default=0, ge=0)
    avg_price: Optional[float] = Field(default=0, ge=0)
    rate_type: Optional[str] = Field(default=None, max_length=20)
    rate_value: Optional[float] = Field(default=None, ge=0)
    maturity_date: Optional[date] = None

    @field_validator('ticker')
    @classmethod
    def ticker_uppercase(cls, v: str) -> str:
        v = v.upper().strip()
        if not re.match(r'^[A-Z0-9\-._]+$', v):
            raise ValueError('Ticker deve conter apenas letras, números, hífens, pontos e underscores')
        return v

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Nome não pode ser vazio')
        return v.strip()

    @field_validator('rate_type')
    @classmethod
    def validate_rate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_types = ['SELIC', 'CDI', 'PREFIXADO', 'IPCA+', 'IPCA']
            if v.upper() not in valid_types:
                raise ValueError(f'Tipo de taxa inválido. Use: {", ".join(valid_types)}')
            return v.upper()
        return None


class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    avg_price: Optional[float] = None
    rate_type: Optional[str] = None
    rate_value: Optional[float] = None
    maturity_date: Optional[date] = None


class InvestmentResponse(BaseModel):
    id: int
    type: InvestmentType
    ticker: str
    name: str
    quantity: Optional[float] = None
    avg_price: Optional[float] = None
    rate_type: Optional[str] = None
    rate_value: Optional[float] = None
    maturity_date: Optional[date] = None
    created_at: Optional[datetime] = None
    deposits: list[InvestmentDepositResponse] = []
    redemptions: list[InvestmentRedemptionResponse] = []
    stock_transactions: list[StockTransactionResponse] = []
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
    name: str = Field(..., max_length=150, min_length=1)
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0, ge=0)
    deadline: Optional[date] = None
    icon: str = Field(default="target", max_length=50)
    color: str = Field(default="#6C63FF", pattern=r'^#[0-9A-Fa-f]{6}$')

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Nome não pode ser vazio')
        return v.strip()


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
    current_balance: float
    monthly_result: float
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
