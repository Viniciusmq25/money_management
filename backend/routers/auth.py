from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from schemas import LoginRequest, TokenResponse, ChangePasswordRequest
from auth import verify_password, create_access_token, get_current_user, hash_password, security, _decode_token
from database import get_db
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    if data.username:
        user = db.query(User).filter(User.username == data.username.lower()).first()
    else:
        # Backward compat: no username provided → single admin user
        user = db.query(User).filter(User.is_admin == True).order_by(User.id).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
        )
    token = create_access_token(user_id=user.id, is_admin=user.is_admin)
    return TokenResponse(access_token=token)


@router.get("/me")
async def me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    payload = _decode_token(credentials.credentials)
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    real = db.query(User).filter(User.id == int(sub)).first()
    if real is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    impersonating_id = payload.get("impersonating_id")
    effective = real
    if impersonating_id:
        effective = db.query(User).filter(User.id == impersonating_id).first() or real
    return {
        "user": {"id": effective.id, "username": effective.username, "is_admin": effective.is_admin},
        "real_user": {"id": real.id, "username": real.username, "is_admin": real.is_admin} if impersonating_id else None,
        "impersonating": bool(impersonating_id),
    }


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha atual incorreta",
        )
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Senha alterada com sucesso"}
