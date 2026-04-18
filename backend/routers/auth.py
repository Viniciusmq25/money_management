from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from schemas import LoginRequest, TokenResponse, ChangePasswordRequest
from auth import verify_password, create_access_token, get_current_user, hash_password
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
