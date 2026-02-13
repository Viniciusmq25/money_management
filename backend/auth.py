from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from config import get_settings
from typing import Optional

security = HTTPBearer()
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRATION_DAYS)
    to_encode = {"exp": expire, "sub": "admin"}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_password_hash_from_db() -> Optional[str]:
    """Busca o hash da senha do banco de dados (se existir)."""
    try:
        from database import SessionLocal
        from models.app_settings import AppSettings
        db = SessionLocal()
        try:
            setting = db.query(AppSettings).filter(AppSettings.key == "password_hash").first()
            return setting.value if setting else None
        finally:
            db.close()
    except Exception:
        return None


def verify_password(password: str, password_hash: Optional[str] = None) -> bool:
    """Verifica senha usando hash bcrypt. Prioriza banco de dados sobre .env."""
    try:
        # Prioridade: hash passado > banco de dados > .env
        if password_hash is None:
            password_hash = get_password_hash_from_db()
        if password_hash is None:
            password_hash = settings.APP_PASSWORD_HASH
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def hash_password(password: str) -> str:
    """Gera hash bcrypt para uma senha."""
    return pwd_context.hash(password)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
        return username
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
