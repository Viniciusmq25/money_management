# Migration Plan: `Float` → `Numeric` para campos monetários

## Objetivo

Todos os campos de dinheiro/quantidade/preço/taxa hoje usam `Float` (IEEE 754, lossy). Isso causa erros de arredondamento acumulados ao longo de centenas de transações (`0.1 + 0.2 = 0.30000000000000004`). Trocar por `Numeric` (PostgreSQL `NUMERIC(p,s)`, mapeado pra `Decimal` em Python) elimina a perda de precisão.

App é single-user, deploy via `docker compose up -d --build --force-recreate`. Janela de downtime curta é aceitável → migration **in-place** (sem shadow column).

---

## Inventário exaustivo (13 colunas em 8 tabelas)

| Tabela | Coluna | Categoria | Tipo atual | Tipo novo | Justificativa |
|---|---|---|---|---|---|
| `transactions` | `amount` | dinheiro BRL | `Float` | `NUMERIC(15, 2)` | R$ até 10 trilhões, centavos exatos |
| `investments` | `quantity` | unidades | `Float` | `NUMERIC(20, 8)` | Cobre satoshi (BTC 1e-8) e ações fracionadas |
| `investments` | `avg_price` | preço (BRL) | `Float` | `NUMERIC(20, 8)` | Suporta shitcoins (R$ 0,00000001) e BTC (R$ 300k+) |
| `investments` | `rate_value` | taxa % | `Float` | `NUMERIC(8, 4)` | Ex: 13.7500%, espaço pra 4 casas |
| `investment_deposits` | `amount` | dinheiro BRL | `Float` | `NUMERIC(15, 2)` | Igual transactions.amount |
| `investment_redemptions` | `amount` | dinheiro BRL | `Float` | `NUMERIC(15, 2)` | Igual transactions.amount |
| `stock_transactions` | `quantity` | unidades | `Float` | `NUMERIC(20, 8)` | Frações de ações + crypto |
| `stock_transactions` | `price_per_share` | preço (BRL) | `Float` | `NUMERIC(20, 8)` | Range amplo |
| `goals` | `target_amount` | dinheiro BRL | `Float` | `NUMERIC(15, 2)` | Meta em R$ |
| `goals` | `current_amount` | dinheiro BRL | `Float` | `NUMERIC(15, 2)` | Progresso em R$ |
| `categories` | `budget_limit` | dinheiro BRL | `Float` | `NUMERIC(15, 2)` | Limite em R$ |
| `quote_cache` | `price` | preço/cotação | `Float` | `NUMERIC(20, 8)` | Range crypto + ações + USD/BRL |
| `quote_cache` | `change_24h` | percentual | `Float` | `NUMERIC(8, 4)` | Variação % |

**Convenções:**
- `NUMERIC(15, 2)` → 13 dígitos inteiros + 2 decimais (máx R$ 9.999.999.999.999,99)
- `NUMERIC(20, 8)` → 12 dígitos inteiros + 8 decimais (cobre BTC, satoshi, ações fracionárias)
- `NUMERIC(8, 4)` → 4 dígitos inteiros + 4 decimais (máx 9999,9999%)

---

## Fases

### Fase 1 — Preparação (offline, ~10 min)

1. **Backup do banco**: `docker compose exec money-db pg_dump -U money money_management > backup_pre_decimal_$(date +%F).sql`
2. **Snapshot dos totais atuais** pra comparação pós-migration. Salvar resultado de queries-chave em arquivo:
   - `SELECT SUM(amount) FROM transactions WHERE user_id=<user>;`
   - `SELECT SUM(amount) FROM investment_deposits;`
   - `SELECT SUM(target_amount), SUM(current_amount) FROM goals;`
   - Comparar com `/api/dashboard` e `/api/investments/summary` antes de derrubar.
3. **Branch dedicada**: `git checkout -b feat/decimal-migration`.

### Fase 2 — Código (em branch)

1. **Modelos SQLAlchemy** (`backend/models/*.py`): trocar `Float` por `Numeric(p, s)` nas 13 colunas. Importar `Numeric` do `sqlalchemy`.
2. **Schemas Pydantic** (`backend/schemas.py`): trocar `float` por `Decimal` em todos os campos de dinheiro/quantidade/preço/taxa. Importar `from decimal import Decimal`. Para serialização JSON consistente, configurar `model_config = ConfigDict(json_encoders={Decimal: lambda v: float(v)})` OU usar `condecimal(max_digits=..., decimal_places=...)` — decidir na execução (recomendo `Decimal` puro + encoder pra `float` na borda da API, mantendo precisão no DB).
3. **Lógica de negócio** — auditar e ajustar onde aparecer aritmética com float literal. Pontos críticos identificados:
   - `routers/investments.py:_build_enriched` — todos os `qty * avg`, `quantity * price_per_share`, soma de PL. Decimal não opera com float literal → converter `0.0`, `0` constantes para `Decimal("0")`.
   - `routers/investments.py:_calculate_caixinha_value` — `(1 + annual_rate / 100) ** (1/252) - 1`. Cuidado: `Decimal ** float` não é permitido. Pode manter `daily_rate` como `Decimal` mas o expoente precisa ser `int`. Reformular como capitalização diária inteira: `Decimal('1.000xxxx') ** Decimal(days)`.
   - `services/binance.py` — comparação `abs(existing.quantity - total) > 0.00000001`. Funciona com Decimal (converter literal pra `Decimal("0.00000001")`).
   - `routers/dashboard.py` — todas as agregações de saldo, gráfico de equity, etc.
   - `routers/goals.py:22` — cálculo de progresso.
4. **Helpers**: criar `backend/utils/money.py` com funções de conversão segura: `as_money(x) -> Decimal`, `q2(x)` (quantize a 2 casas), `q8(x)` (quantize a 8 casas).

### Fase 3 — Migration SQL (execução em produção)

Arquivo: `backend/migration_float_to_decimal.sql`. Estrutura:

```sql
BEGIN;
-- Pra cada coluna: cast preservando o valor existente.
-- Postgres exige USING quando o cast não é implícito de double precision para numeric.
ALTER TABLE transactions
  ALTER COLUMN amount TYPE NUMERIC(15, 2) USING ROUND(amount::numeric, 2);
-- ... repetir para cada uma das 13 colunas
COMMIT;
```

Ordem sugerida (sem dependência, mas agrupado por tabela pra rollback parcial mais fácil):
1. `transactions.amount`
2. `categories.budget_limit`
3. `goals.target_amount`, `goals.current_amount`
4. `investments.quantity`, `investments.avg_price`, `investments.rate_value`
5. `investment_deposits.amount`
6. `investment_redemptions.amount`
7. `stock_transactions.quantity`, `stock_transactions.price_per_share`
8. `quote_cache.price`, `quote_cache.change_24h`

Tudo numa transação BEGIN/COMMIT. Em caso de erro: ROLLBACK automático.

**`ROUND(... , N)` antes do cast** é crucial — converte o lixo IEEE 754 acumulado pro número "esperado" antes de gravar. Sem isso, valores como `0.30000000000000004` viram `0.30000000` em vez de `0.30`.

### Fase 4 — Deploy

1. Parar serviço: `docker compose stop money-management`.
2. Aplicar migration: `docker compose exec money-db psql -U money -d money_management -f /migrations/migration_float_to_decimal.sql` (precisa montar volume com o arquivo, ou usar `cat ... | docker compose exec -T money-db psql ...`).
3. Pull do código novo + rebuild: `git pull && docker compose up -d --build --force-recreate money-management`.

### Fase 5 — Verificação

1. Comparar os totais snapshotados na Fase 1 com os novos (devem bater até centavo).
2. Carregar dashboard, conferir cards principais.
3. Criar uma transação nova de teste (R$ 0.10), conferir que persiste exato.
4. Sincronizar Binance, conferir que conversão USDT/BRL bate com cotação BCB.
5. `/api/investments/summary` — comparar valores antes/depois.

---

## Riscos

1. **Aritmética mista Decimal/float em runtime**: `TypeError: unsupported operand type(s) for *: 'decimal.Decimal' and 'float'`. Mitigação: auditar toda multiplicação/divisão em `routers/` e `services/` na Fase 2. **Risco médio.**
2. **Erros de quantização em cálculos compostos** (juros compostos da caixinha): a fórmula `(1 + r) ** days` precisa ser portada cuidadosamente. **Risco médio.**
3. **Frontend espera `number` no JSON, não string**: `Decimal` serializa como string por padrão. Configurar encoder pra `float` na borda da API. Frontend não muda. **Risco baixo.**
4. **Dados existentes com lixo float**: já estão imprecisos. ROUND no cast fixa o número mais próximo do que o usuário "queria", mas se houver muito drift acumulado, números podem mudar em centavos isolados. **Risco baixo, mas comunicar.**
5. **Sem testes automatizados**: verificação 100% manual. **Risco alto** — daí a importância dos snapshots da Fase 1.
6. **ALTER TABLE em produção bloqueia a tabela**: Postgres reescreve a tabela em type changes. Com poucos milhares de linhas, leva segundos. App offline durante migration → não há conflito. **Risco baixo dado o porte.**
7. **Rollback após Fase 4 exige restore do dump**: ALTER TABLE in-place não é reversível por ROLLBACK depois de COMMIT. Daí pg_dump obrigatório na Fase 1.

---

## Rollback

**Antes do COMMIT na Fase 3** → `ROLLBACK;` na transação. Nada muda.

**Depois do COMMIT** → restore completo:
1. `docker compose stop money-management`
2. `docker compose exec money-db psql -U money -c "DROP DATABASE money_management;"`
3. `docker compose exec money-db psql -U money -c "CREATE DATABASE money_management;"`
4. `cat backup_pre_decimal_*.sql | docker compose exec -T money-db psql -U money money_management`
5. `git checkout main && docker compose up -d --build --force-recreate money-management`

---

## Decisões deixadas pra hora de executar

- **`Decimal` puro vs `condecimal(...)` no Pydantic**: `Decimal` + json encoder é mais flexível. `condecimal` valida no schema mas força repetir `max_digits`/`decimal_places` em cada campo. Recomendo `Decimal` + encoder global.
- **Alembic?**: Hoje o projeto usa SQL bruto (`migration_fix_cache_constraint.sql`). Adicionar Alembic agora é escopo extra. Sugestão: adotar Alembic **depois** desta migration, como base limpa.
- **Política de quantize**: aplicar `q2()` antes de gravar em colunas `NUMERIC(15,2)`? Postgres faz round automático no INSERT/UPDATE, mas explicitar no Python evita surpresas. Decidir na Fase 2.

---

## Checklist de execução

- [ ] Fase 1: backup + snapshots de totais salvos
- [ ] Fase 2: modelos, schemas, lógica, helpers commitados em branch
- [ ] Fase 3: `migration_float_to_decimal.sql` revisado linha por linha
- [ ] Fase 4: deploy executado, container saudável
- [ ] Fase 5: totais conferidos, transação teste OK, Binance sync OK
- [ ] PR merged, branch deletada, backup arquivado por 30 dias
