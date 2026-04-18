from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import get_admin_user, hash_password, create_access_token
from models.user import User
from models.category import Category
from schemas import UserCreateAdmin, UserResetPassword, UserResponse, TokenResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _clone_categories(db: Session, source_user_id: int, target_user_id: int) -> None:
    """Snapshot copy of source user's categories into target user."""
    source_cats = db.query(Category).filter(Category.user_id == source_user_id).all()
    for cat in source_cats:
        db.add(Category(
            user_id=target_user_id,
            name=cat.name,
            icon=cat.icon,
            color=cat.color,
            type=cat.type,
            budget_limit=cat.budget_limit,
        ))


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    return db.query(User).order_by(User.id).all()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreateAdmin,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=409, detail="Username já existe")
    new_user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        is_admin=False,
    )
    db.add(new_user)
    db.flush()
    _clone_categories(db, source_user_id=admin.id, target_user_id=new_user.id)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    data: UserResetPassword,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.is_admin and user.id != admin.id:
        raise HTTPException(status_code=403, detail="Não é possível resetar senha de outro admin")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Não é possível excluir um admin")
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.post("/impersonate/{user_id}", response_model=TokenResponse)
async def impersonate(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target.is_admin:
        raise HTTPException(status_code=403, detail="Não é possível personificar outro admin")
    token = create_access_token(user_id=admin.id, is_admin=True, impersonating_id=target.id)
    return TokenResponse(access_token=token)


@router.post("/stop-impersonating", response_model=TokenResponse)
async def stop_impersonating(admin: User = Depends(get_admin_user)):
    token = create_access_token(user_id=admin.id, is_admin=True)
    return TokenResponse(access_token=token)
