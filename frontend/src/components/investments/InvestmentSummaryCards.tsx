import type { InvestmentSummary } from "../../types";
import { formatCurrency, formatPercent } from "../../utils/format";

interface Props {
  summary: InvestmentSummary;
  showMoney: boolean;
}

export default function InvestmentSummaryCards({ summary, showMoney }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-primary-light rounded-2xl p-5 border border-border">
        <p className="text-sm text-muted mb-1">Total Investido</p>
        <p className="text-2xl font-bold text-white">
          {formatCurrency(summary.total_invested, showMoney)}
        </p>
      </div>
      <div className="bg-primary-light rounded-2xl p-5 border border-border">
        <p className="text-sm text-muted mb-1">Valor Atual</p>
        <p className="text-2xl font-bold text-white">
          {formatCurrency(summary.total_current_value, showMoney)}
        </p>
      </div>
      <div className="bg-primary-light rounded-2xl p-5 border border-border">
        <p className="text-sm text-muted mb-1">Lucro/Prejuízo</p>
        <p
          className={`text-2xl font-bold ${summary.profit_loss >= 0 ? "text-success" : "text-danger"}`}
        >
          {formatCurrency(summary.profit_loss, showMoney)}
        </p>
        <p
          className={`text-sm font-medium ${summary.profit_loss_pct >= 0 ? "text-success" : "text-danger"}`}
        >
          {formatPercent(summary.profit_loss_pct, showMoney)}
        </p>
      </div>
    </div>
  );
}
