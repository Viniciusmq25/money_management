from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.transaction import Transaction, TransactionType, TransactionSource
from models.import_log import ImportLog
from schemas import ImportPreviewResponse, ImportPreviewTransaction, ImportConfirmRequest
from services.ofx_parser import parse_ofx
from services.csv_parser import parse_csv

router = APIRouter(prefix="/api/imports", tags=["imports"], dependencies=[Depends(get_current_user)])

CATEGORY_KEYWORDS = {
    "Alimentação": ["supermercado", "mercado", "restaurante", "lanchonete", "padaria", "ifood", "uber eats", "rappi", "pizza", "burguer", "açougue", "hortifruti"],
    "Transporte": ["uber", "99", "combustível", "gasolina", "estacionamento", "pedágio", "posto", "shell", "ipiranga"],
    "Moradia": ["aluguel", "condomínio", "luz", "energia", "água", "gás", "internet", "celular", "telefone"],
    "Saúde": ["farmácia", "drogaria", "hospital", "médico", "plano de saúde", "unimed", "amil", "drogasil"],
    "Lazer": ["netflix", "spotify", "cinema", "teatro", "show", "amazon prime", "disney", "hbo", "game", "steam"],
    "Educação": ["escola", "faculdade", "curso", "udemy", "alura", "livro", "livraria"],
    "Compras": ["magazine", "americanas", "amazon", "mercado livre", "shopee", "shein", "aliexpress"],
    "Salário": ["salario", "salário", "folha", "pagamento", "remuneração"],
}


def suggest_category(description: str) -> str | None:
    desc_lower = description.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in desc_lower:
                return category
    return None


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    filename = file.filename or "unknown"

    if filename.lower().endswith(".ofx"):
        transactions, bank = parse_ofx(content)
    elif filename.lower().endswith(".csv"):
        transactions, bank = parse_csv(content)
    else:
        raise HTTPException(status_code=400, detail="Formato não suportado. Use .ofx ou .csv")

    # Check for duplicates
    existing_fit_ids = set()
    if transactions:
        fit_ids = [t["fit_id"] for t in transactions if t.get("fit_id")]
        if fit_ids:
            existing = db.query(Transaction.fit_id).filter(Transaction.fit_id.in_(fit_ids)).all()
            existing_fit_ids = {e[0] for e in existing}

    preview_txns = []
    total_income = 0
    total_expense = 0
    duplicates_count = 0

    for t in transactions:
        is_dup = t.get("fit_id") in existing_fit_ids
        if is_dup:
            duplicates_count += 1
        txn_type = TransactionType.INCOME if t["amount"] >= 0 else TransactionType.EXPENSE
        amount = abs(t["amount"])

        if txn_type == TransactionType.INCOME:
            total_income += amount
        else:
            total_expense += amount

        preview_txns.append(ImportPreviewTransaction(
            date=t["date"],
            amount=amount,
            description=t["description"],
            type=txn_type,
            fit_id=t.get("fit_id"),
            suggested_category=suggest_category(t["description"]),
            is_duplicate=is_dup,
        ))

    dates = [t["date"] for t in transactions]
    return ImportPreviewResponse(
        filename=filename,
        bank=bank,
        date_start=min(dates) if dates else None,
        date_end=max(dates) if dates else None,
        transactions=preview_txns,
        total_income=total_income,
        total_expense=total_expense,
        duplicates_count=duplicates_count,
    )


@router.post("/confirm")
async def confirm_import(data: ImportConfirmRequest, db: Session = Depends(get_db)):
    # Create import log
    non_dup_txns = [t for t in data.transactions if not t.is_duplicate]
    if not non_dup_txns:
        raise HTTPException(status_code=400, detail="Nenhuma transação nova para importar")

    dates = [t.date for t in non_dup_txns]
    import_log = ImportLog(
        filename=data.filename,
        bank=data.bank,
        date_start=min(dates),
        date_end=max(dates),
        num_transactions=len(non_dup_txns),
    )
    db.add(import_log)
    db.flush()

    for t in non_dup_txns:
        txn = Transaction(
            type=t.type,
            amount=t.amount,
            description=t.description,
            date=t.date,
            source=TransactionSource.IMPORT,
            import_id=import_log.id,
            fit_id=t.fit_id,
        )
        db.add(txn)

    db.commit()
    return {"ok": True, "imported": len(non_dup_txns), "import_id": import_log.id}


@router.get("/history")
async def import_history(db: Session = Depends(get_db)):
    logs = db.query(ImportLog).order_by(ImportLog.imported_at.desc()).limit(20).all()
    return logs
