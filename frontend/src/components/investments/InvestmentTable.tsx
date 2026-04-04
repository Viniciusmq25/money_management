import { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  X,
  Bitcoin,
  Building2,
  Landmark,
  BarChart3,
  Globe,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { Investment } from "../../types";
import { formatCurrency, formatPercent } from "../../utils/format";
import { TYPE_LABELS, TYPE_COLORS } from "../../constants/theme";

type Tab = "ALL" | "CRYPTO" | "FII" | "RENDA_FIXA" | "ACAO_BR" | "ACAO_GLOBAL";

type SortColumn =
  | "ticker"
  | "type"
  | "quantity"
  | "avg_price"
  | "current_price"
  | "total_invested"
  | "current_value"
  | "profit_loss";
type SortDirection = "asc" | "desc";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ALL: <LayoutGrid className="w-5 h-5" />,
  CRYPTO: <Bitcoin className="w-5 h-5" />,
  FII: <Building2 className="w-5 h-5" />,
  RENDA_FIXA: <Landmark className="w-5 h-5" />,
  ACAO_BR: <BarChart3 className="w-5 h-5" />,
  ACAO_GLOBAL: <Globe className="w-5 h-5" />,
};

interface Props {
  positions: Investment[];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  showMoney: boolean;
  onDelete: (id: number) => void;
  onOpenTransactions: (inv: Investment) => void;
}

export default function InvestmentTable({
  positions,
  tab,
  onTabChange,
  showMoney,
  onDelete,
  onOpenTransactions,
}: Props) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("current_value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case "ticker":
          aVal = a.ticker.toLowerCase();
          bVal = b.ticker.toLowerCase();
          break;
        case "type":
          aVal = TYPE_LABELS[a.type] || a.type;
          bVal = TYPE_LABELS[b.type] || b.type;
          break;
        case "quantity":
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case "avg_price":
          aVal = a.avg_price;
          bVal = b.avg_price;
          break;
        case "current_price":
          aVal = a.current_price ?? 0;
          bVal = b.current_price ?? 0;
          break;
        case "total_invested":
          aVal = a.total_invested ?? 0;
          bVal = b.total_invested ?? 0;
          break;
        case "current_value":
          aVal = a.current_value ?? 0;
          bVal = b.current_value ?? 0;
          break;
        case "profit_loss":
          aVal = a.profit_loss ?? 0;
          bVal = b.profit_loss ?? 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [positions, sortColumn, sortDirection]);

  const thClass =
    "text-left px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none";
  const thClassRight =
    "text-right px-5 py-3 text-xs font-semibold text-muted uppercase cursor-pointer hover:text-white transition select-none";

  return (
    <div className="lg:col-span-3 bg-primary-light rounded-2xl border border-border overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {(
          ["ALL", "CRYPTO", "FII", "RENDA_FIXA", "ACAO_BR", "ACAO_GLOBAL"] as Tab[]
        ).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              tab === t
                ? "text-accent border-b-2 border-accent"
                : "text-muted hover:text-white"
            }`}
          >
            {TYPE_ICONS[t]} {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {sortedPositions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted">
            {tab === "ALL"
              ? "Nenhum investimento cadastrado"
              : `Nenhum investimento em ${TYPE_LABELS[tab]}`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass} onClick={() => handleSort("ticker")}>
                  <div className="flex items-center gap-1">
                    Ativo {getSortIcon("ticker")}
                  </div>
                </th>
                {tab === "ALL" && (
                  <th className={thClass} onClick={() => handleSort("type")}>
                    <div className="flex items-center gap-1">
                      Tipo {getSortIcon("type")}
                    </div>
                  </th>
                )}
                <th className={thClassRight} onClick={() => handleSort("quantity")}>
                  <div className="flex items-center justify-end gap-1">
                    Qtd {getSortIcon("quantity")}
                  </div>
                </th>
                <th className={thClassRight} onClick={() => handleSort("avg_price")}>
                  <div className="flex items-center justify-end gap-1">
                    Preço Médio {getSortIcon("avg_price")}
                  </div>
                </th>
                <th className={thClassRight} onClick={() => handleSort("current_price")}>
                  <div className="flex items-center justify-end gap-1">
                    Atual {getSortIcon("current_price")}
                  </div>
                </th>
                <th className={thClassRight} onClick={() => handleSort("total_invested")}>
                  <div className="flex items-center justify-end gap-1">
                    Investido {getSortIcon("total_invested")}
                  </div>
                </th>
                <th className={thClassRight} onClick={() => handleSort("current_value")}>
                  <div className="flex items-center justify-end gap-1">
                    Valor Atual {getSortIcon("current_value")}
                  </div>
                </th>
                <th className={thClassRight} onClick={() => handleSort("profit_loss")}>
                  <div className="flex items-center justify-end gap-1">
                    P&L {getSortIcon("profit_loss")}
                  </div>
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {sortedPositions.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border last:border-0 hover:bg-surface-hover transition"
                >
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {inv.ticker}
                      </p>
                      <p className="text-xs text-muted">{inv.name}</p>
                    </div>
                  </td>
                  {tab === "ALL" && (
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-medium px-2 py-1 rounded-lg"
                        style={{
                          backgroundColor: `${TYPE_COLORS[inv.type]}20`,
                          color: TYPE_COLORS[inv.type],
                        }}
                      >
                        {TYPE_LABELS[inv.type]}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3 text-right text-sm text-white">
                    {inv.quantity.toLocaleString("pt-BR", {
                      maximumFractionDigits: 8,
                    })}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-white">
                    {formatCurrency(inv.avg_price, showMoney)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div>
                      <span className="text-sm text-white">
                        {inv.current_price
                          ? formatCurrency(inv.current_price, showMoney)
                          : "\u2014"}
                      </span>
                      {inv.change_24h !== null &&
                        inv.change_24h !== undefined && (
                          <span
                            className={`block text-xs font-medium ${inv.change_24h >= 0 ? "text-success" : "text-danger"}`}
                          >
                            {formatPercent(inv.change_24h, showMoney)}
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-white">
                    {formatCurrency(inv.total_invested || 0, showMoney)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-white">
                    {inv.current_value
                      ? formatCurrency(inv.current_value, showMoney)
                      : "\u2014"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {inv.profit_loss !== null &&
                    inv.profit_loss !== undefined ? (
                      <div className="flex items-center justify-end gap-1">
                        {inv.profit_loss >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-danger" />
                        )}
                        <span
                          className={`text-sm font-semibold ${inv.profit_loss >= 0 ? "text-success" : "text-danger"}`}
                        >
                          {formatCurrency(
                            Math.abs(inv.profit_loss),
                            showMoney,
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">{"\u2014"}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {inv.type === "RENDA_FIXA" && (
                        <button
                          onClick={() => onOpenTransactions(inv)}
                          className="p-1.5 text-muted hover:text-accent transition cursor-pointer"
                          title="Movimentações (Aplicações/Resgates)"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(inv.id)}
                        className="p-1.5 text-muted hover:text-danger transition cursor-pointer"
                        title="Excluir Ativo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
