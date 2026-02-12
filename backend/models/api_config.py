from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base
from cryptography.fernet import Fernet
from config import get_settings
import base64

settings = get_settings()


def get_cipher():
    """Get Fernet cipher for encrypting/decrypting API secrets."""
    # Use JWT_SECRET as base for encryption key
    key = settings.JWT_SECRET.encode()[:32].ljust(32, b"=")
    key = base64.urlsafe_b64encode(key)
    return Fernet(key)


class APIConfig(Base):
    """Store encrypted API credentials for external services."""
    __tablename__ = "api_configs"

    id = Column(Integer, primary_key=True, index=True)
    service = Column(String(50), nullable=False, unique=True)  # e.g., "binance"
    api_key = Column(String(500), nullable=False)  # encrypted
    api_secret = Column(String(500), nullable=False)  # encrypted
    is_active = Column(Boolean, default=True)
    last_sync = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def set_credentials(self, api_key: str, api_secret: str):
        """Encrypt and store API credentials."""
        cipher = get_cipher()
        self.api_key = cipher.encrypt(api_key.encode()).decode()
        self.api_secret = cipher.encrypt(api_secret.encode()).decode()

    def get_credentials(self) -> tuple[str, str]:
        """Decrypt and return API credentials."""
        cipher = get_cipher()
        api_key = cipher.decrypt(self.api_key.encode()).decode()
        api_secret = cipher.decrypt(self.api_secret.encode()).decode()
        return api_key, api_secret
