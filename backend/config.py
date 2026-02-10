from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_PASSWORD: str = "changeme"
    JWT_SECRET: str = "super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 7
    DATABASE_URL: str = "postgresql://money:money@money-db:5432/money_management"
    COINGECKO_API_KEY: str = ""
    BRAPI_TOKEN: str = ""
    CACHE_TTL_CRYPTO: int = 300  # 5 minutes
    CACHE_TTL_FII: int = 1800  # 30 minutes
    CACHE_TTL_SELIC: int = 86400  # 24 hours

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
