import type { InvestmentSummary } from "../../types";
import { formatCurrency, formatPercent } from "../../utils/format";

type Tab = "ALL" | "CRYPTO" | "FII" | "RENDA_FIXA" | "ACAO_BR" | "ACAO_GLOBAL";

interface Props {
  summary: InvestmentSummary;
  showMoney: boolean;
  tab: Tab;
}

export default function InvestmentSummaryCards({ summary, showMoney, tab }: Props) {
  let totalInvested: number;
  let totalCurrent: number;
  let profitLoss: number;
  let profitLossPct: number;

  if (tab === "ALL") {
    totalInvested = summary.total_invested;
    totalCurrent = summary.total_current_value;
    profitLoss = summary.profit_loss;
    profitLossPct = summary.profit_loss_pct;
  } else {
    const filtered = summary.positions.filter((p) => p.type === tab);
    totalInvested = filtered.reduce((s, p) => s + (p.total_invested ?? 0), 0);
    totalCurrent = filtered.reduce((s, p) => s + (p.current_value ?? 0), 0);
    profitLoss = filtered.reduce((s, p) => s + (p.profit_loss ?? 0), 0);
    profitLossPct = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="bg-primary-light rounded-lg p-4 border border-border">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">Total Investido</p>
        <p className="text-xl font-bold text-white font-mono">
          {formatCurrency(totalInvested, showMoney)}
        </p>
      </div>
      <div className="bg-primary-light rounded-lg p-4 border border-border">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">Valor Atual</p>
        <p className="text-xl font-bold text-white font-mono">
          {formatCurrency(totalCurrent, showMoney)}
        </p>
      </div>
      <div className="bg-primary-light rounded-lg p-4 border border-border">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">Lucro/Prejuízo</p>
        <p className={`text-xl font-bold font-mono ${profitLoss >= 0 ? "text-success" : "text-danger"}`}>
          {formatCurrency(profitLoss, showMoney)}
        </p>
        <p className={`text-xs font-medium mt-0.5 font-mono ${profitLossPct >= 0 ? "text-success" : "text-danger"}`}>
          {formatPercent(profitLossPct, showMoney)}
        </p>
      </div>
    </div>
  );
}
