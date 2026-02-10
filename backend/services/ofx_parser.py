from ofxparse import OfxParser
from io import BytesIO
from datetime import date


def parse_ofx(content: bytes) -> tuple[list[dict], str | None]:
    """Parse an OFX file and return a list of transactions and bank name."""
    try:
        ofx = OfxParser.parse(BytesIO(content))
    except Exception:
        # Try with different encoding
        try:
            text = content.decode("latin-1")
            ofx = OfxParser.parse(BytesIO(text.encode("utf-8")))
        except Exception as e:
            raise ValueError(f"Erro ao parsear arquivo OFX: {str(e)}")

    bank_name = None
    transactions = []

    if hasattr(ofx, "signon") and hasattr(ofx.signon, "fi_org"):
        bank_name = ofx.signon.fi_org

    for account in ofx.accounts:
        statement = account.statement
        if statement is None:
            continue

        for txn in statement.transactions:
            trans_date = txn.date
            if hasattr(trans_date, "date"):
                trans_date = trans_date.date()
            elif isinstance(trans_date, str):
                trans_date = date.fromisoformat(trans_date[:10])

            transactions.append({
                "date": trans_date,
                "amount": float(txn.amount),
                "description": (txn.memo or txn.payee or "Sem descrição").strip(),
                "fit_id": txn.id if txn.id else None,
            })

    return transactions, bank_name
