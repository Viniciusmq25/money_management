import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { TYPE_LABELS } from "../../constants/theme";

type InvestmentType = "CRYPTO" | "FII" | "RENDA_FIXA" | "ACAO_BR" | "ACAO_GLOBAL";

export interface InvestmentFormData {
  type: InvestmentType;
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  rate_type: string | null;
  rate_value: number | null;
  maturity_date: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InvestmentFormData) => void;
  isPending: boolean;
  defaultType: string;
}

export default function InvestmentForm({
  open,
  onClose,
  onSubmit,
  isPending,
  defaultType,
}: Props) {
  const [form, setForm] = useState({
    type: (defaultType === "ALL" ? "CRYPTO" : defaultType) as InvestmentType,
    ticker: "",
    name: "",
    quantity: "",
    avg_price: "",
    rate_type: "",
    rate_value: "",
    maturity_date: "",
  });

  // Sync defaultType when modal opens
  const effectiveType = open
    ? form.type
    : ((defaultType === "ALL" ? "CRYPTO" : defaultType) as InvestmentType);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type: form.type,
      ticker: form.ticker.toUpperCase(),
      name: form.name,
      quantity: parseFloat(form.quantity) || 0,
      avg_price: parseFloat(form.avg_price) || 0,
      rate_type: form.type === "RENDA_FIXA" ? form.rate_type || null : null,
      rate_value:
        form.type === "RENDA_FIXA"
          ? form.rate_value
            ? parseFloat(form.rate_value)
            : null
          : null,
      maturity_date:
        form.type === "RENDA_FIXA" ? form.maturity_date || null : null,
    });
    setForm({
      type: (defaultType === "ALL" ? "CRYPTO" : defaultType) as InvestmentType,
      ticker: "",
      name: "",
      quantity: "",
      avg_price: "",
      rate_type: "",
      rate_value: "",
      maturity_date: "",
    });
  };

  const typeOptions: InvestmentType[] = [
    "CRYPTO",
    "FII",
    "RENDA_FIXA",
    "ACAO_BR",
    "ACAO_GLOBAL",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-primary-light rounded-2xl p-6 border border-border w-full max-w-md space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Novo Investimento
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <select
          value={form.type}
          onChange={(e) =>
            setForm({ ...form, type: e.target.value as InvestmentType })
          }
          className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder={
            form.type === "CRYPTO"
              ? "Ticker (ex: BTC)"
              : form.type === "FII"
                ? "Ticker (ex: HGLG11)"
                : form.type === "ACAO_BR"
                  ? "Ticker (ex: PETR4)"
                  : form.type === "ACAO_GLOBAL"
                    ? "Ticker (ex: AAPL34)"
                    : "Nome do título (ex: CDB Nubank)"
          }
          value={form.ticker}
          onChange={(e) => setForm({ ...form, ticker: e.target.value })}
          required
          className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="text"
          placeholder="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted ml-1">
              {form.type === "RENDA_FIXA" ? "Valor aplicado (R$)" : "Quantidade"}
            </label>
            <input
              type="number"
              step="any"
              placeholder={form.type === "RENDA_FIXA" ? "Ex: 1000" : "Qtd"}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted ml-1">
              {form.type === "RENDA_FIXA"
                ? "Preço unitário (R$)"
                : "Preço médio (R$)"}
            </label>
            <input
              type="number"
              step="0.01"
              placeholder={form.type === "RENDA_FIXA" ? "Ex: 1" : "Preço"}
              value={form.avg_price}
              onChange={(e) => setForm({ ...form, avg_price: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {form.type === "RENDA_FIXA" && (
          <>
            <select
              value={form.rate_type}
              onChange={(e) =>
                setForm({ ...form, rate_type: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="">Tipo de taxa</option>
              <option value="CDI">% do CDI</option>
              <option value="SELIC">% da Selic</option>
              <option value="PREFIXADO">Prefixado</option>
              <option value="IPCA+">IPCA+</option>
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Taxa (ex: 100 para 100% CDI)"
              value={form.rate_value}
              onChange={(e) =>
                setForm({ ...form, rate_value: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div>
              <label className="text-xs text-muted mb-1 block">
                Vencimento
              </label>
              <input
                type="date"
                value={form.maturity_date}
                onChange={(e) =>
                  setForm({ ...form, maturity_date: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Adicionando...
            </>
          ) : (
            "Adicionar"
          )}
        </button>
      </form>
    </div>
  );
}
