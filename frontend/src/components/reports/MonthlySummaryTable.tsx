import { formatCurrency } from "../../utils/format";

interface TrendByCategory {
  [period: string]: {
    income: { name: string; color: string; value: number }[];
    expense: { name: string; color: string; value: number }[];
  };
}

interface MonthlySummaryTableProps {
  barData: any[];
  trendByCategory: TrendByCategory | undefined;
  isDaily: boolean;
  showMoney: boolean;
}

export default function MonthlySummaryTable({
  barData,
  trendByCategory,
  isDaily,
  showMoney,
}: MonthlySummaryTableProps) {
  return (
    <div className="bg-primary-light rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          {isDaily ? "Resumo Diário" : "Resumo Mensal"}
        </h3>
        <button className="text-accent text-sm font-medium hover:underline cursor-pointer">
          Ver Todos os Meses
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                {isDaily ? "Dia" : "Mês"}
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                Receitas
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                Despesas
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                Saldo
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                Maior Gasto
              </th>
            </tr>
          </thead>
          <tbody>
            {barData.map((row: any, i: number) => {
              const periodCats = trendByCategory?.[row.month];
              const topExpense = periodCats?.expense?.[0];
              return (
                <tr
                  key={i}
                  className="border-b border-border last:border-0 hover:bg-surface-hover transition"
                >
                  <td className="px-5 py-3.5 text-sm text-white font-medium">
                    {row.fullName}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-success text-right">
                    {formatCurrency(row.income, showMoney)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-danger text-right">
                    {formatCurrency(row.expense, showMoney)}
                  </td>
                  <td
                    className={`px-5 py-3.5 text-sm font-semibold text-right ${
                      row.saldo >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {row.saldo >= 0 ? "+" : ""}
                    {formatCurrency(row.saldo, showMoney)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {topExpense ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                        style={{
                          backgroundColor: `${topExpense.color}20`,
                          color: topExpense.color,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: topExpense.color }}
                        />
                        {topExpense.name}
                      </span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
