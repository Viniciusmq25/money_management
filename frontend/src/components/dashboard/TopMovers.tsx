import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useInvestmentSummary } from "../../hooks/useInvestments";
import { formatPercent } from "../../utils/format";

interface Props {
  showMoney: boolean;
}

export default function TopMovers({ showMoney }: Props) {
  const { data: summary } = useInvestmentSummary();

  const positions = (summary?.positions ?? []).filter(
    (p) => p.profit_loss_pct !== null && p.profit_loss_pct !== undefined
  );

  const sorted = [...positions].sort((a, b) => (b.profit_loss_pct ?? 0) - (a.profit_loss_pct ?? 0));
  const gainers = sorted.filter((p) => (p.profit_loss_pct ?? 0) > 0).slice(0, 3);
  const losers = [...sorted].reverse().filter((p) => (p.profit_loss_pct ?? 0) < 0).slice(0, 3);
  const movers = [...gainers, ...losers];

  if (movers.length === 0) {
    return (
      <div className="bg-primary-light rounded-lg p-4 border border-border">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Maiores Variações</h3>
        <p className="text-muted text-sm text-center py-4">Adicione investimentos para ver variações</p>
      </div>
    );
  }

  return (
    <div className="bg-primary-light rounded-lg p-4 border border-border">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Maiores Variações</h3>
      <div className="space-y-1.5">
        {movers.map((p) => {
          const pct = p.profit_loss_pct ?? 0;
          const isUp = pct >= 0;
          return (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isUp ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                  {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{p.ticker}</p>
                  <p className="text-xs text-muted leading-tight truncate max-w-[120px]">{p.name}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold font-mono ${isUp ? "text-success" : "text-danger"}`}>
                {isUp ? "+" : ""}{formatPercent(pct, showMoney)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
