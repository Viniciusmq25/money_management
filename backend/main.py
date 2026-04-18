from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from database import engine, Base, SessionLocal
from models import *  # noqa: F401, F403
from routers import auth, categories, transactions, investments, goals, imports, dashboard, admin
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


def bootstrap_admin_user(db_engine):
    """Create initial admin user 'vini' from existing password hash, then drop it from app_settings."""
    import logging
    log = logging.getLogger(__name__)
    try:
        from models.user import User
        from models.app_settings import AppSettings
        from config import get_settings as _get_settings
        db = SessionLocal()
        try:
            if db.query(User).count() > 0:
                return
            existing = db.query(AppSettings).filter(AppSettings.key == "password_hash").first()
            pwd_hash = existing.value if existing else _get_settings().APP_PASSWORD_HASH
            if not pwd_hash:
                log.warning("No password hash available to bootstrap admin user")
                return
            admin = User(username="vini", password_hash=pwd_hash, is_admin=True)
            db.add(admin)
            if existing:
                db.delete(existing)
            db.commit()
            log.info("Admin user 'vini' bootstrapped from existing password hash")
        finally:
            db.close()
    except Exception as e:
        log.warning(f"Admin bootstrap skipped: {e}")


DOMAIN_TABLES_USER_ID = [
    "transactions",
    "categories",
    "investments",
    "investment_deposits",
    "investment_redemptions",
    "stock_transactions",
    "goals",
    "import_logs",
    "api_configs",
]


def migrate_add_user_id_columns(db_engine):
    """Add user_id FK to all domain tables, backfill to admin user, then SET NOT NULL.
    Also fixes api_configs unique constraint to (user_id, service)."""
    import logging
    log = logging.getLogger(__name__)
    try:
        from models.user import User
        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.is_admin == True).order_by(User.id).first()
            if admin is None:
                log.warning("No admin user; skipping user_id column migration")
                return
            admin_id = admin.id
        finally:
            db.close()

        with db_engine.connect() as conn:
            for table in DOMAIN_TABLES_USER_ID:
                # Skip if table doesn't exist yet (fresh install — create_all will set NOT NULL)
                exists = conn.execute(text(
                    "SELECT 1 FROM information_schema.tables WHERE table_name = :t"
                ), {"t": table}).fetchone()
                if not exists:
                    continue
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_id INTEGER "
                    f"REFERENCES users(id) ON DELETE CASCADE"
                ))
                conn.execute(text(
                    f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"
                ), {"uid": admin_id})
                conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN user_id SET NOT NULL"))
                conn.execute(text(
                    f"CREATE INDEX IF NOT EXISTS ix_{table}_user_id ON {table}(user_id)"
                ))
            # Fix api_configs unique constraint: drop old (service) unique, add (user_id, service)
            conn.execute(text(
                "ALTER TABLE api_configs DROP CONSTRAINT IF EXISTS api_configs_service_key"
            ))
            # idempotent: check constraint exists by name before adding
            existing_uq = conn.execute(text(
                "SELECT 1 FROM pg_constraint WHERE conname = 'uq_api_configs_user_service'"
            )).fetchone()
            if not existing_uq:
                conn.execute(text(
                    "ALTER TABLE api_configs ADD CONSTRAINT uq_api_configs_user_service "
                    "UNIQUE (user_id, service)"
                ))
            conn.commit()
        log.info("user_id columns migrated; existing rows assigned to admin id=%s", admin_id)
    except Exception as e:
        log.warning(f"user_id migration skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Migrate enum values first (before create_all)
    migrate_investment_enum(engine)
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Wipe quantity/avg_price for stock types (movimentações are source of truth)
    migrate_stock_data(engine)
    # Bootstrap admin user from legacy password_hash
    bootstrap_admin_user(engine)
    # Add user_id columns to all domain tables, backfill to admin
    migrate_add_user_id_columns(engine)
    # Seed default categories for the admin user (no-op if already present)
    db = SessionLocal()
    try:
        from models.user import User
        admin = db.query(User).filter(User.is_admin == True).order_by(User.id).first()
        if admin:
            seed_categories(db, admin.id)
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
app.include_router(admin.router)
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
