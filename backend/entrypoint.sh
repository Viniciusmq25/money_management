#!/bin/bash

# Entrypoint script para Money Management
# Executa migrações e inicia a aplicação

set -e

echo "======================================================================"
echo "Money Management - Iniciando aplicação..."
echo "======================================================================"
echo ""

# Aguardar banco de dados ficar pronto
echo "⏳ Aguardando banco de dados..."
for i in {1..30}; do
    if pg_isready -h money-db -U money -d money_management >/dev/null 2>&1; then
        echo "✅ Banco de dados pronto"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Timeout aguardando banco de dados"
        exit 1
    fi
    sleep 1
done

echo ""

# Executar migrações (Alembic)
echo "🔄 Executando migrações do Alembic..."
if alembic upgrade head; then
    echo "✅ Migrações Alembic concluídas"
else
    echo "⚠️  Alembic não encontrado ou migrações falharam (isso pode ser normal)"
fi

echo ""

# Aplicar migração customizada do cache
echo "🔄 Aplicando migração customizada (cache constraint)..."
python3 << 'EOF'
import os
from sqlalchemy import text, create_engine

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("⚠️  DATABASE_URL não configurado, pulando migração customizada")
else:
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Verificar se constraint já existe
            result = conn.execute(text(
                "SELECT conname FROM pg_constraint WHERE conname = 'uq_ticker_asset_type'"
            )).fetchone()

            if result:
                print("✅ Constraint 'uq_ticker_asset_type' já existe")
            else:
                print("Aplicando constraint composta...")
                # Remover constraint antiga se existir
                try:
                    conn.execute(text("ALTER TABLE quote_cache DROP CONSTRAINT quote_cache_ticker_key"))
                    print("✓ Removida constraint antiga")
                except:
                    pass  # Constraint não existia

                # Adicionar nova constraint
                conn.execute(text(
                    "ALTER TABLE quote_cache ADD CONSTRAINT uq_ticker_asset_type UNIQUE (ticker, asset_type)"
                ))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_quote_cache_asset_type ON quote_cache(asset_type)"
                ))
                conn.commit()
                print("✅ Migração customizada aplicada com sucesso")
    except Exception as e:
        print(f"⚠️  Erro ao aplicar migração: {e}")
        print("Continuando mesmo assim...")

EOF

echo ""

# Migração: migrate RENDA_FIXA data to deposits, drop purchase_date and original_amount
echo "🔄 Migrando dados deprecated de investments para deposits..."
python3 << 'EOF'
import os
from sqlalchemy import text, create_engine

db_url = os.getenv("DATABASE_URL")
if db_url:
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Check if original_amount column still exists
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'investments' AND column_name = 'original_amount'"
            )).fetchone()

            if not result:
                print("✅ Colunas deprecated já foram removidas")
            else:
                # Migrate RENDA_FIXA investments that have original_amount but no deposits yet
                migrated = conn.execute(text("""
                    INSERT INTO investment_deposits (investment_id, amount, deposit_date)
                    SELECT i.id,
                           COALESCE(i.original_amount, i.quantity * i.avg_price),
                           COALESCE(i.purchase_date, i.created_at::date)
                    FROM investments i
                    WHERE i.type = 'RENDA_FIXA'
                      AND (i.original_amount > 0 OR (i.quantity > 0 AND i.avg_price > 0))
                      AND NOT EXISTS (
                          SELECT 1 FROM investment_deposits d WHERE d.investment_id = i.id
                      )
                """))
                print(f"✓ Migrados {migrated.rowcount} investimentos RENDA_FIXA para deposits")

                # Drop only truly deprecated columns
                for col in ['purchase_date', 'original_amount']:
                    try:
                        conn.execute(text(f"ALTER TABLE investments DROP COLUMN IF EXISTS {col}"))
                    except Exception:
                        pass
                conn.commit()
                print("✅ Colunas deprecated removidas com sucesso")
    except Exception as e:
        print(f"⚠️  Erro na migração: {e}")
EOF

echo ""

# Migração: criar tabela app_settings (para troca de senha)
echo "🔄 Verificando tabela app_settings..."
python3 << 'EOF'
import os
from sqlalchemy import text, create_engine

db_url = os.getenv("DATABASE_URL")
if db_url:
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_settings')"
            )).fetchone()
            
            if result and result[0]:
                print("✅ Tabela app_settings já existe")
            else:
                print("Criando tabela app_settings...")
                conn.execute(text("""
                    CREATE TABLE app_settings (
                        id SERIAL PRIMARY KEY,
                        key VARCHAR(100) NOT NULL UNIQUE,
                        value VARCHAR(500) NOT NULL,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """))
                conn.commit()
                print("✅ Tabela app_settings criada com sucesso")
    except Exception as e:
        print(f"⚠️  Erro ao verificar/criar tabela: {e}")
EOF

echo ""

# Iniciar aplicação
echo "🚀 Iniciando Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
