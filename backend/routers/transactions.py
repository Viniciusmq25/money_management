from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from datetime import date
from database import get_db
from auth import get_current_user
from models.user import User
from models.transaction import Transaction, TransactionType
from schemas import TransactionCreate, TransactionUpdate, TransactionResponse

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _apply_filters(query, type, category_id, date_from, date_to, search):
    if type:
        query = query.filter(Transaction.type == type)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if date_from:
        query = query.filter(Transaction.date >= date_from)
    if date_to:
        query = query.filter(Transaction.date <= date_to)
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
    return query


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    type: TransactionType | None = None,
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).options(joinedload(Transaction.category)).filter(
        Transaction.user_id == current_user.id
    )
    query = _apply_filters(query, type, category_id, date_from, date_to, search)
    return query.order_by(desc(Transaction.date), desc(Transaction.id)).offset(offset).limit(limit).all()


@router.get("/count")
async def count_transactions(
    type: TransactionType | None = None,
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    query = _apply_filters(query, type, category_id, date_from, date_to, search)
    return {"count": query.count()}


@router.post("", response_model=TransactionResponse)
async def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = Transaction(user_id=current_user.id, **data.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return db.query(Transaction).options(joinedload(Transaction.category)).filter(Transaction.id == txn.id).first()


@router.put("/{id}", response_model=TransactionResponse)
async def update_transaction(
    id: int,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(txn, key, val)
    db.commit()
    db.refresh(txn)
    return db.query(Transaction).options(joinedload(Transaction.category)).filter(Transaction.id == txn.id).first()


@router.delete("/{id}")
async def delete_transaction(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    db.delete(txn)
    db.commit()
    return {"ok": True}
