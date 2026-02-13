-- Migration: Fix quote_cache unique constraint
-- Data: 2026-02-12
-- Descrição: Altera constraint de ticker único para (ticker, asset_type) único

-- 1. Remover constraint antiga se existir
ALTER TABLE quote_cache DROP CONSTRAINT IF EXISTS quote_cache_ticker_key;

-- 2. Adicionar nova constraint composta
ALTER TABLE quote_cache
ADD CONSTRAINT uq_ticker_asset_type UNIQUE (ticker, asset_type);

-- 3. Adicionar índice em asset_type para melhor performance
CREATE INDEX IF NOT EXISTS idx_quote_cache_asset_type ON quote_cache(asset_type);

-- 4. Verificar resultado
SELECT
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'quote_cache'::regclass
AND conname = 'uq_ticker_asset_type';

-- Output esperado: constraint uq_ticker_asset_type (type 'u' para unique)
