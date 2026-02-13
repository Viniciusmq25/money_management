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

# Migração: adicionar coluna original_amount em investments
echo "🔄 Verificando coluna original_amount em investments..."
python3 << 'EOF'
import os
from sqlalchemy import text, create_engine

db_url = os.getenv("DATABASE_URL")
if db_url:
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'investments' AND column_name = 'original_amount'"
            )).fetchone()
            
            if result:
                print("✅ Coluna original_amount já existe")
            else:
                print("Adicionando coluna original_amount...")
                conn.execute(text(
                    "ALTER TABLE investments ADD COLUMN original_amount FLOAT"
                ))
                conn.commit()
                print("✅ Coluna original_amount adicionada com sucesso")
    except Exception as e:
        print(f"⚠️  Erro ao verificar/adicionar coluna: {e}")
EOF

echo ""

# Iniciar aplicação
echo "🚀 Iniciando Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
