import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import type { InvestmentFormData } from "./InvestmentForm";

type StockTab = "FII" | "ACAO_BR" | "ACAO_GLOBAL";
type SupportedTab = "RENDA_FIXA" | StockTab;

interface Props {
  tab: SupportedTab;
  onSubmit: (data: InvestmentFormData) => void;
  isPending: boolean;
  colSpan: number;
}

const RATE_TYPE_OPTIONS = [
  { value: "CDI", label: "% do CDI" },
  { value: "SELIC", label: "% da Selic" },
  { value: "PREFIXADO", label: "Prefixado" },
  { value: "IPCA+", label: "IPCA+" },
];

export default function InlineAddInvestmentForm({ tab, onSubmit, isPending, colSpan }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [rateType, setRateType] = useState("");
  const [rateValue, setRateValue] = useState("");

  const reset = () => {
    setTicker("");
    setName("");
    setRateType("");
    setRateValue("");
    setExpanded(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "RENDA_FIXA") {
      const autoTicker = name.toUpperCase().replace(/\s+/g, "_").slice(0, 20) || "TITULO";
      onSubmit({
        type: "RENDA_FIXA",
        ticker: autoTicker,
        name,
        quantity: 0,
        avg_price: 0,
        rate_type: rateType || null,
        rate_value: rateValue ? parseFloat(rateValue) : null,
        maturity_date: null,
      });
    } else {
      onSubmit({
        type: tab,
        ticker: ticker.toUpperCase(),
        name,
        quantity: 0,
        avg_price: 0,
        rate_type: null,
        rate_value: null,
        maturity_date: null,
      });
    }
    reset();
  };

  if (!expanded) {
    return (
      <tr className="border-t border-border/30">
        <td colSpan={colSpan}>
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-2 px-5 py-3 text-muted hover:text-accent text-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar ativo
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border/30 bg-surface/30">
      <td colSpan={colSpan} className="px-5 py-3">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          {tab !== "RENDA_FIXA" && (
            <input
              type="text"
              placeholder="Ticker (ex: HGLG11)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
              autoFocus
              className="px-3 py-1.5 bg-primary-light border border-border rounded-lg text-white text-sm w-36 focus:outline-none focus:ring-2 focus:ring-accent placeholder-muted/50"
            />
          )}
          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={tab === "RENDA_FIXA"}
            className="px-3 py-1.5 bg-primary-light border border-border rounded-lg text-white text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-accent placeholder-muted/50"
          />
          {tab === "RENDA_FIXA" && (
            <>
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value)}
                className="px-3 py-1.5 bg-primary-light border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
              >
                <option value="">Tipo de taxa</option>
                {RATE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Taxa (ex: 100)"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                className="px-3 py-1.5 bg-primary-light border border-border rounded-lg text-white text-sm w-36 focus:outline-none focus:ring-2 focus:ring-accent placeholder-muted/50"
              />
            </>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Adicionar
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 text-muted hover:text-white text-sm transition cursor-pointer"
          >
            Cancelar
          </button>
        </form>
      </td>
    </tr>
  );
}
