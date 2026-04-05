from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from database import engine, Base, SessionLocal
from models import *  # noqa: F401, F403
from routers import auth, categories, transactions, investments, goals, imports, dashboard
from seed import seed_categories
from sqlalchemy import text


def migrate_investment_enum(db_engine):
    """Add new values to the investmenttype PostgreSQL enum if they don't exist."""
    new_values = ['ACAO_BR', 'ACAO_GLOBAL', 'RENDA_FIXA']
    try:
        with db_engine.connect() as conn:
            # Check if the enum type exists first
            result = conn.execute(text(
                "SELECT 1 FROM pg_type WHERE typname = 'investmenttype'"
            ))
            if not result.fetchone():
                return  # Enum type doesn't exist yet, create_all will handle it
            for val in new_values:
                try:
                    conn.execute(text(
                        f"ALTER TYPE investmenttype ADD VALUE IF NOT EXISTS '{val}'"
                    ))
                    conn.commit()
                except Exception:
                    conn.rollback()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Enum migration skipped: {e}")


def migrate_stock_data(db_engine):
    """Wipe quantity/avg_price for stock-type investments — movimentações are now source of truth."""
    try:
        with db_engine.connect() as conn:
            conn.execute(text(
                "UPDATE investments SET quantity=0, avg_price=0 "
                "WHERE type IN ('FII','ACAO_BR','ACAO_GLOBAL')"
            ))
            conn.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Stock data migration skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Migrate enum values first (before create_all)
    migrate_investment_enum(engine)
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Wipe quantity/avg_price for stock types (movimentações are source of truth)
    migrate_stock_data(engine)
    # Seed default categories
    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Money Management API",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8000",  # Production
        # Adicione aqui seus domínios de produção quando fizer deploy
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Register routers
app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(investments.router)
app.include_router(goals.router)
app.include_router(imports.router)
app.include_router(dashboard.router)
# Health check
@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Serve React static files
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
