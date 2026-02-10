import csv
import io
from datetime import date, datetime


def parse_csv(content: bytes) -> tuple[list[dict], str | None]:
    """Parse a CSV bank statement. Tries to auto-detect format."""
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.reader(io.StringIO(text), delimiter=",")
    rows = list(reader)

    if len(rows) < 2:
        # Try semicolon delimiter
        reader = csv.reader(io.StringIO(text), delimiter=";")
        rows = list(reader)

    if len(rows) < 2:
        raise ValueError("Arquivo CSV vazio ou formato inválido")

    header = [col.strip().lower() for col in rows[0]]

    # Try to detect columns
    date_col = _find_col(header, ["data", "date", "dt", "data_transacao", "data transação"])
    amount_col = _find_col(header, ["valor", "amount", "value", "vlr", "quantia"])
    desc_col = _find_col(header, ["descricao", "descrição", "description", "memo", "historico", "histórico", "lançamento", "lancamento"])

    if date_col is None or amount_col is None:
        raise ValueError("Não foi possível identificar as colunas de data e valor no CSV")

    transactions = []
    for row in rows[1:]:
        if len(row) <= max(date_col, amount_col):
            continue

        try:
            trans_date = _parse_date(row[date_col].strip())
            amount = _parse_amount(row[amount_col].strip())
            description = row[desc_col].strip() if desc_col is not None and desc_col < len(row) else "Sem descrição"

            if trans_date and amount != 0:
                transactions.append({
                    "date": trans_date,
                    "amount": amount,
                    "description": description,
                    "fit_id": None,
                })
        except (ValueError, IndexError):
            continue

    return transactions, None


def _find_col(header: list[str], candidates: list[str]) -> int | None:
    for i, col in enumerate(header):
        for candidate in candidates:
            if candidate in col:
                return i
    return None


def _parse_date(text: str) -> date | None:
    formats = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(text: str) -> float:
    # Handle Brazilian format: 1.234,56
    text = text.replace("R$", "").replace(" ", "").strip()
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    return float(text)
