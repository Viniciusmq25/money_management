import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
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

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { showMoney } = useMoneyVisibility();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-36 bg-surface animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonChart className="lg:col-span-2" />
          <SkeletonChart />
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  if (!data) return <p className="text-muted">Erro ao carregar dados.</p>;

  const trendData = data.monthly_trend.map((m) => ({
    ...m,
    name: formatMonth(m.month),
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Saldo Atual"
          value={formatCurrency(data.current_balance, showMoney)}
          subtitle={`Resultado do mês: ${formatCurrency(data.monthly_result, showMoney)}`}
          icon={<Wallet className="w-5 h-5" />}
          trend={data.current_balance >= 0 ? "up" : "down"}
          color="accent"
        />
        <KpiCard
          title="Receitas"
          value={formatCurrency(data.total_income, showMoney)}
          icon={<TrendingUp className="w-5 h-5" />}
          trend="up"
          color="success"
        />
        <KpiCard
          title="Despesas"
          value={formatCurrency(data.total_expense, showMoney)}
          icon={<TrendingDown className="w-5 h-5" />}
          trend="down"
          color="danger"
        />
        <KpiCard
          title="Patrimônio Investido"
          value={formatCurrency(data.total_current_value || data.total_invested, showMoney)}
          subtitle={data.total_invested > 0 ? formatPercent(data.investment_change_pct, showMoney) : undefined}
          icon={<PiggyBank className="w-5 h-5" />}
          trend={data.investment_change_pct >= 0 ? "up" : "down"}
          color="accent"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart - Monthly trend */}
        <div className="lg:col-span-2 bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-muted mb-4">Receitas vs Despesas</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3B3F5C" />
              <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#2A2D4A", border: "1px solid #3B3F5C", borderRadius: 12, color: "#F1F5F9" }}
                formatter={(value: number) => formatCurrency(value, showMoney)}
              />
              <Area type="monotone" dataKey="income" name="Receitas" stroke="#10B981" fill="url(#incomeGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Despesas" stroke="#EF4444" fill="url(#expenseGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - Expenses by category */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-muted mb-4">Gastos por Categoria</h3>
          {data.expense_by_category.length > 0 ? (() => {
            const pieTotal = data.expense_by_category.reduce((acc, e) => acc + e.value, 0);
            const pieData = data.expense_by_category.map((e) => ({
              ...e,
              percent: pieTotal > 0 ? (e.value / pieTotal) * 100 : 0,
            }));
            return (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                      label={({ cx, cy, midAngle, outerRadius, payload }: any) => {
                        if (payload.percent < 5) return null;
                        const RADIAN = Math.PI / 180;
                        const radius = outerRadius + 16;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="#CBD5E1" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="central">
                            {`${payload.percent.toFixed(1)}%`}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1E2139", border: "1px solid #3B3F5C", borderRadius: 12, padding: "10px 14px" }}
                      itemStyle={{ color: "#FFFFFF", fontSize: 13, fontWeight: 500 }}
                      labelStyle={{ color: "#94A3B8", fontSize: 12, marginBottom: 4 }}
                      formatter={(v: number, _name: string, entry: any) => [
                        `${formatCurrency(v, showMoney)} (${entry.payload.percent.toFixed(1)}%)`,
                        entry.payload.name
                      ]}
                      separator=" "
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {pieData.slice(0, 5).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-muted">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-xs">{cat.percent.toFixed(1)}%</span>
                        <span className="text-white font-medium">{formatCurrency(cat.value, showMoney)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })() : (
            <p className="text-muted text-sm text-center py-8">Nenhuma despesa neste mês</p>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-muted mb-4">Últimas Transações</h3>
          <div className="space-y-3">
            {data.recent_transactions.length > 0 ? (
              data.recent_transactions.map((txn: any) => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        txn.type === "INCOME" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}
                    >
                      {txn.type === "INCOME" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{txn.description}</p>
                      <p className="text-xs text-muted">
                        {formatDate(txn.date)}
                        {txn.category ? ` · ${txn.category.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${txn.type === "INCOME" ? "text-success" : "text-danger"}`}>
                    {txn.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(txn.amount, showMoney)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted text-sm text-center py-4">Nenhuma transação registrada</p>
            )}
          </div>
        </div>

        {/* Market data */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-muted mb-4">Mercado</h3>
          <div className="space-y-3">
            {/* Selic / CDI */}
            {data.market_data.rates && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-xs text-muted">Taxa Selic</p>
                  <p className="text-lg font-bold text-white">{data.market_data.rates.selic_annual?.toFixed(2) || "—"}%</p>
                  <p className="text-xs text-muted">a.a.</p>
                </div>
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-xs text-muted">CDI</p>
                  <p className="text-lg font-bold text-white">{data.market_data.rates.cdi_annual?.toFixed(2) || "—"}%</p>
                  <p className="text-xs text-muted">a.a.</p>
                </div>
              </div>
            )}

            {/* Crypto prices */}
            {data.market_data.crypto &&
              Object.entries(data.market_data.crypto).map(([ticker, info]) => (
                <div key={ticker} className="flex items-center justify-between bg-surface rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{ticker}</p>
                    <p className="text-xs text-muted">Cripto</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(info.price, showMoney)}</p>
                    <p className={`text-xs font-medium ${info.change_24h >= 0 ? "text-success" : "text-danger"}`}>
                      {formatPercent(info.change_24h, showMoney)}
                    </p>
                  </div>
                </div>
              ))}

            {/* FII prices */}
            {data.market_data.fii &&
              Object.entries(data.market_data.fii).map(([ticker, info]) => (
                <div key={ticker} className="flex items-center justify-between bg-surface rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{ticker}</p>
                    <p className="text-xs text-muted">FII</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(info.price, showMoney)}</p>
                    <p className={`text-xs font-medium ${info.change_24h >= 0 ? "text-success" : "text-danger"}`}>
                      {formatPercent(info.change_24h, showMoney)}
                    </p>
                  </div>
                </div>
              ))}

            {!data.market_data.crypto && !data.market_data.fii && (
              <p className="text-muted text-sm text-center py-4">Adicione investimentos para ver cotações</p>
            )}
          </div>
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
    <div className="bg-primary-light rounded-2xl p-5 border border-border hover:border-accent/30 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted">{title}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle && (
        <p className={`text-sm font-medium mt-1 ${trend === "up" ? "text-success" : "text-danger"}`}>{subtitle}</p>
      )}
    </div>
  );
}
