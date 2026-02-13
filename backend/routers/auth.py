from fastapi import APIRouter, Depends
from schemas import LoginRequest, TokenResponse, ChangePasswordRequest
from auth import verify_password, create_access_token, get_current_user, hash_password
from fastapi import HTTPException, status
from database import get_db
from sqlalchemy.orm import Session
from models.app_settings import AppSettings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    if not verify_password(data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha incorreta",
        )
    token = create_access_token()
    return TokenResponse(access_token=token)


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Altera a senha do usuário."""
    # Verificar senha atual
    if not verify_password(data.current_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha atual incorreta",
        )
    
    # Gerar hash da nova senha
    new_hash = hash_password(data.new_password)
    
    # Salvar no banco de dados (sobrescreve .env)
    setting = db.query(AppSettings).filter(AppSettings.key == "password_hash").first()
    if setting:
        setting.value = new_hash
    else:
        setting = AppSettings(key="password_hash", value=new_hash)
        db.add(setting)
    
    db.commit()
    
    return {"message": "Senha alterada com sucesso"}
