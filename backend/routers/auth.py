from fastapi import APIRouter
from schemas import LoginRequest, TokenResponse
from auth import verify_password, create_access_token
from fastapi import HTTPException, status

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
