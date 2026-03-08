import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from config import get_settings
from database import get_db
from schemas import AssistantChatRequest, AssistantChatResponse, AssistantContextResponse
from services.assistant import build_financial_snapshot, generate_assistant_reply


router = APIRouter(prefix="/api/assistant", tags=["assistant"], dependencies=[Depends(get_current_user)])


@router.get("/context", response_model=AssistantContextResponse)
async def get_assistant_context(db: Session = Depends(get_db)):
    settings = get_settings()
    snapshot = await build_financial_snapshot(db)
    return {
        "configured": bool(settings.ANTHROPIC_API_KEY),
        "model": settings.ANTHROPIC_MODEL,
        "suggested_prompts": [
            "Monte um plano para fechar o mês com folga.",
            "Analise meus gastos recentes e diga onde cortar primeiro.",
            "Quais metas estão mais pressionadas hoje?",
            "Se eu quiser comprar algo parcelado, como avaliar sem me enrolar?",
        ],
        "snapshot": snapshot,
    }


@router.post("/chat", response_model=AssistantChatResponse)
async def chat_with_assistant(payload: AssistantChatRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY não configurada no backend")

    snapshot = await build_financial_snapshot(
        db,
        purchase_amount=payload.purchase_amount,
        purchase_description=payload.purchase_description,
    )

    try:
        reply, model = await generate_assistant_reply(
            message=payload.message,
            history=[item.model_dump() for item in payload.history],
            snapshot=snapshot,
        )
    except httpx.HTTPStatusError as exc:  # type: ignore[name-defined]
        detail = exc.response.text[:500] if exc.response is not None else "Erro na Anthropic"
        raise HTTPException(status_code=502, detail=f"Falha ao consultar Anthropic: {detail}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar resposta da IA: {str(exc)}") from exc

    return {
        "reply": reply,
        "model": model,
        "snapshot": snapshot,
    }