import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency, formatPercent, formatMonth, formatDate } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import { useDashboard } from "../hooks/useDashboard";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "../components/common/Skeleton";
import TopMovers from "../components/dashboard/TopMovers";

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { showMoney } = useMoneyVisibility();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-7 w-32 bg-surface animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <SkeletonChart className="lg:col-span-2" />
          <SkeletonChart />
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  if (!data) return <p className="text-muted">Erro ao carregar dados.</p>;

  const equityData = data.equity_trend.map((m) => ({
    ...m,
    name: formatMonth(m.month),
  }));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white font-display">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          title="Saldo Atual"
          value={formatCurrency(data.current_balance, showMoney)}
          subtitle={`Resultado do mês: ${formatCurrency(data.monthly_result, showMoney)}`}
          icon={<Wallet className="w-4 h-4" />}
          trend={data.current_balance >= 0 ? "up" : "down"}
          color="accent"
        />
        <KpiCard
          title="Receitas"
          value={formatCurrency(data.total_income, showMoney)}
          icon={<TrendingUp className="w-4 h-4" />}
          trend="up"
          color="success"
        />
        <KpiCard
          title="Despesas"
          value={formatCurrency(data.total_expense, showMoney)}
          icon={<TrendingDown className="w-4 h-4" />}
          trend="down"
          color="danger"
        />
        <KpiCard
          title="Patrimônio Investido"
          value={formatCurrency(data.total_current_value || data.total_invested, showMoney)}
          subtitle={data.total_invested > 0 ? formatPercent(data.investment_change_pct, showMoney) : undefined}
          icon={<PiggyBank className="w-4 h-4" />}
          trend={data.investment_change_pct >= 0 ? "up" : "down"}
          color="accent"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Line chart — total equity (cash + invested at cost) */}
        <div className="lg:col-span-2 bg-primary-light rounded-lg p-4 border border-border">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Patrimônio Total</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={equityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C2330" />
              <XAxis dataKey="name" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#0B0E13", border: "1px solid #1C2330", borderRadius: 6, color: "#F5F7FA", fontSize: 12 }}
                formatter={(value: number) => formatCurrency(value, showMoney)}
              />
              <Line type="monotone" dataKey="equity" name="Patrimônio" stroke="#00E08A" strokeWidth={1.5} dot={{ fill: "#00E08A", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#00E08A", stroke: "#07090C", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart — last 30 days */}
        <div className="bg-primary-light rounded-lg p-4 border border-border">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Gastos · 30 dias</h3>
          {data.last_30d_expense_by_category.length > 0 ? (() => {
            const pieTotal = data.last_30d_expense_by_category.reduce((acc, e) => acc + e.value, 0);
            const pieData = data.last_30d_expense_by_category.map((e) => ({
              ...e,
              percent: pieTotal > 0 ? (e.value / pieTotal) * 100 : 0,
            }));
            return (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                      label={({ cx, cy, midAngle, outerRadius, payload }: any) => {
                        if (payload.percent < 5) return null;
                        const RADIAN = Math.PI / 180;
                        const radius = outerRadius + 14;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="#8A93A6" fontSize={10} fontWeight={600} textAnchor="middle" dominantBaseline="central">
                            {`${payload.percent.toFixed(1)}%`}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0B0E13", border: "1px solid #1C2330", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}
                      itemStyle={{ color: "#F5F7FA", fontWeight: 500 }}
                      labelStyle={{ color: "#8A93A6", marginBottom: 2 }}
                      formatter={(v: number, _name: string, entry: any) => [
                        `${formatCurrency(v, showMoney)} (${entry.payload.percent.toFixed(1)}%)`,
                        entry.payload.name
                      ]}
                      separator=" "
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pieData.slice(0, 5).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-muted">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted">{cat.percent.toFixed(1)}%</span>
                        <span className="text-white font-medium font-mono">{formatCurrency(cat.value, showMoney)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })() : (
            <p className="text-muted text-sm text-center py-8">Nenhuma despesa nos últimos 30 dias</p>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-primary-light rounded-lg p-4 border border-border">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Últimas Transações</h3>
          <div className="space-y-0">
            {data.recent_transactions.length > 0 ? (
              data.recent_transactions.map((txn: any) => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                        txn.type === "INCOME" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}
                    >
                      {txn.type === "INCOME" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium leading-tight">{txn.description}</p>
                      <p className="text-xs text-muted leading-tight">
                        {formatDate(txn.date)}
                        {txn.category ? ` · ${txn.category.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold font-mono ${txn.type === "INCOME" ? "text-success" : "text-danger"}`}>
                    {txn.type === "INCOME" ? "+" : "-"}{formatCurrency(txn.amount, showMoney)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted text-sm text-center py-4">Nenhuma transação registrada</p>
            )}
          </div>
        </div>

        {/* Top Movers + Market */}
        <div className="flex flex-col gap-3">
          <TopMovers showMoney={showMoney} />

          {/* Market rates */}
          {data.market_data.rates && (
            <div className="bg-primary-light rounded-lg p-4 border border-border">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Taxas</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded p-2.5">
                  <p className="text-xs text-muted">Selic</p>
                  <p className="text-base font-bold text-white font-mono">{data.market_data.rates.selic_annual?.toFixed(2) || "—"}%</p>
                  <p className="text-xs text-muted">a.a.</p>
                </div>
                <div className="bg-surface rounded p-2.5">
                  <p className="text-xs text-muted">CDI</p>
                  <p className="text-base font-bold text-white font-mono">{data.market_data.rates.cdi_annual?.toFixed(2) || "—"}%</p>
                  <p className="text-xs text-muted">a.a.</p>
                </div>
              </div>
            </div>
          )}

          {/* Crypto / FII live prices */}
          {(data.market_data.crypto || data.market_data.fii) && (
            <div className="bg-primary-light rounded-lg p-4 border border-border">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Mercado</h3>
              <div className="space-y-1.5">
                {data.market_data.crypto &&
                  Object.entries(data.market_data.crypto).map(([ticker, info]) => (
                    <div key={ticker} className="flex items-center justify-between bg-surface rounded p-2.5">
                      <div>
                        <p className="text-xs font-semibold text-white">{ticker}</p>
                        <p className="text-xs text-muted">Cripto</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-white font-mono">{formatCurrency(info.price, showMoney)}</p>
                        <p className={`text-xs font-medium font-mono ${info.change_24h >= 0 ? "text-success" : "text-danger"}`}>
                          {formatPercent(info.change_24h, showMoney)}
                        </p>
                      </div>
                    </div>
                  ))}
                {data.market_data.fii &&
                  Object.entries(data.market_data.fii).map(([ticker, info]) => (
                    <div key={ticker} className="flex items-center justify-between bg-surface rounded p-2.5">
                      <div>
                        <p className="text-xs font-semibold text-white">{ticker}</p>
                        <p className="text-xs text-muted">FII</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-white font-mono">{formatCurrency(info.price, showMoney)}</p>
                        <p className={`text-xs font-medium font-mono ${info.change_24h >= 0 ? "text-success" : "text-danger"}`}>
                          {formatPercent(info.change_24h, showMoney)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend: "up" | "down";
  color: string;
}) {
  const colors: Record<string, string> = {
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
    warning: "bg-warning/15 text-warning",
  };

  return (
    <div className="bg-primary-light rounded-lg p-4 border border-border hover:border-accent/30 transition-all duration-150">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted uppercase tracking-wide">{title}</span>
        <div className={`w-7 h-7 rounded flex items-center justify-center ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-white font-mono">{value}</p>
      {subtitle && (
        <p className={`text-xs font-medium mt-1 ${trend === "up" ? "text-success" : "text-danger"}`}>{subtitle}</p>
      )}
    </div>
  );
}
