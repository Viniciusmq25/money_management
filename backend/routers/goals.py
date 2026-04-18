from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.user import User
from models.goal import Goal
from schemas import GoalCreate, GoalUpdate, GoalResponse

router = APIRouter(prefix="/api/goals", tags=["goals"])


def _add_progress(goal: Goal) -> dict:
    data = {
        "id": goal.id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": goal.current_amount,
        "deadline": goal.deadline,
        "icon": goal.icon,
        "color": goal.color,
        "created_at": goal.created_at,
        "progress": round((goal.current_amount / goal.target_amount) * 100, 1) if goal.target_amount > 0 else 0,
    }
    return data


@router.get("", response_model=list[GoalResponse])
async def list_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = db.query(Goal).filter(Goal.user_id == current_user.id).order_by(Goal.deadline).all()
    return [_add_progress(g) for g in goals]


@router.post("", response_model=GoalResponse)
async def create_goal(
    data: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = Goal(user_id=current_user.id, **data.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _add_progress(goal)


@router.put("/{id}", response_model=GoalResponse)
async def update_goal(
    id: int,
    data: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, val)
    db.commit()
    db.refresh(goal)
    return _add_progress(goal)


@router.delete("/{id}")
async def delete_goal(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    db.delete(goal)
    db.commit()
    return {"ok": True}
