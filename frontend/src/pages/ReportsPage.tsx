import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Label,
} from "recharts";
import api from "../api/client";
import { formatCurrency, formatMonth } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import toast from "react-hot-toast";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Wallet,
  CreditCard,
} from "lucide-react";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import { subMonths } from "date-fns";

function formatMonthFull(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"days" | "months">("months");
  const { showMoney } = useMoneyVisibility();

  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    start: subMonths(today, 6),
    end: today,
    label: "Últimos 6 meses",
    months: 6,
  });

  useEffect(() => {
    setLoading(true);
    api
      .get("/dashboard/summary", { params: { months: dateRange.months } })
      .then((r) => setData(r.data))
      .catch(() => toast.error("Erro ao carregar relatórios"))
      .finally(() => setLoading(false));
  }, [dateRange.months]);

  const barData = useMemo(() => {
    if (!data) return [];
    return data.monthly_trend.map((m: any) => ({
      ...m,
      name: formatMonth(m.month),
      fullName: formatMonthFull(m.month),
      saldo: m.income - m.expense,
    }));
  }, [data]);

  const lineData = useMemo(() => {
    if (!data) return [];
    let cumulative = 0;
    return data.monthly_trend.map((m: any) => {
      cumulative += m.income - m.expense;
      return {
        name: formatMonth(m.month),
        patrimonio: cumulative + (data.total_invested || 0),
      };
    });
  }, [data]);

  const stats = useMemo(() => {
    if (!barData.length) return null;
    const totalIncome = barData.reduce((s: number, d: any) => s + d.income, 0);
    const totalExpense = barData.reduce((s: number, d: any) => s + d.expense, 0);
    const totalBalance = totalIncome - totalExpense;

    const lastMonth = barData[barData.length - 1];
    const prevMonth = barData.length > 1 ? barData[barData.length - 2] : null;

    const incomeChange =
      prevMonth && prevMonth.income > 0
        ? ((lastMonth.income - prevMonth.income) / prevMonth.income) * 100
        : 0;
    const expenseChange =
      prevMonth && prevMonth.expense > 0
        ? ((lastMonth.expense - prevMonth.expense) / prevMonth.expense) * 100
        : 0;

    const balanceChange =
      totalIncome > 0 ? (totalBalance / totalIncome) * 100 : 0;

    const firstEquity = lineData.length > 0 ? lineData[0].patrimonio : 0;
    const lastEquity = lineData.length > 0 ? lineData[lineData.length - 1].patrimonio : 0;
    const equityGrowth =
      firstEquity > 0 ? ((lastEquity - firstEquity) / firstEquity) * 100 : 0;

    return {
      totalIncome,
      totalExpense,
      totalBalance,
      incomeChange,
      expenseChange,
      balanceChange,
      equityGrowth,
    };
  }, [barData, lineData]);

  const pieData = useMemo(() => {
    if (!data || !data.expense_by_category?.length) return [];
    const total = data.expense_by_category.reduce(
      (acc: number, e: any) => acc + e.value,
      0
    );
    return data.expense_by_category.map((e: any) => ({
      ...e,
      percent: total > 0 ? (e.value / total) * 100 : 0,
    }));
  }, [data]);

  const pieTotal = useMemo(() => {
    return pieData.reduce((acc: number, e: any) => acc + e.value, 0);
  }, [pieData]);

  function handleDownload() {
    if (!barData.length) return;
    const headers = ["Mês", "Receitas", "Despesas", "Saldo"];
    const rows = barData.map((r: any) => [r.fullName, r.income, r.expense, r.saldo]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-muted">Erro ao carregar dados.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Relatórios</h2>
          <p className="text-sm text-muted mt-1">
            Visão geral detalhada do seu desempenho financeiro.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Days / Months toggle */}
          <div className="flex bg-primary-light rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("days")}
              className={`px-4 py-2 text-sm font-medium transition cursor-pointer ${
                viewMode === "days"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-white"
              }`}
            >
              Dias
            </button>
            <button
              onClick={() => setViewMode("months")}
              className={`px-4 py-2 text-sm font-medium transition cursor-pointer ${
                viewMode === "months"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-white"
              }`}
            >
              Meses
            </button>
          </div>

          {/* Date range picker */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-2.5 bg-primary-light border border-border rounded-xl text-muted hover:text-white hover:border-accent transition cursor-pointer"
            title="Exportar CSV"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border flex items-start justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Total Receitas</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(stats?.totalIncome || 0, showMoney)}
            </p>
            {stats && (
              <div
                className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                  stats.incomeChange >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {stats.incomeChange >= 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                <span>
                  {stats.incomeChange >= 0 ? "+" : ""}
                  {stats.incomeChange.toFixed(1)}% vs mês anterior
                </span>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-success" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border flex items-start justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Total Despesas</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(stats?.totalExpense || 0, showMoney)}
            </p>
            {stats && (
              <div
                className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                  stats.expenseChange <= 0 ? "text-success" : "text-danger"
                }`}
              >
                {stats.expenseChange <= 0 ? (
                  <TrendingDown size={14} />
                ) : (
                  <TrendingUp size={14} />
                )}
                <span>
                  {stats.expenseChange >= 0 ? "+" : ""}
                  {stats.expenseChange.toFixed(1)}% vs mês anterior
                </span>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center shrink-0">
            <CreditCard size={20} className="text-danger" />
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border flex items-start justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Saldo Líquido</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(stats?.totalBalance || 0, showMoney)}
            </p>
            {stats && (
              <div
                className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                  stats.balanceChange >= 0 ? "text-success" : "text-danger"
                }`}
              >
                <TrendingUp size={14} />
                <span>
                  +{stats.balanceChange.toFixed(1)}% geral
                </span>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-accent" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Revenue vs Expenses Bar Chart */}
        <div className="lg:col-span-3 bg-primary-light rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">
              Receitas vs Despesas
            </h3>
            <div className="flex items-center gap-4 text-xs text-muted">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-success" />
                <span>Receitas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-danger" />
                <span>Despesas</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#3B3F5C"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94A3B8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "#2A2D4A",
                  border: "1px solid #3B3F5C",
                  borderRadius: 12,
                  color: "#F1F5F9",
                }}
                formatter={(v: number) => formatCurrency(v, showMoney)}
                cursor={{ fill: "rgba(107, 99, 255, 0.08)" }}
              />
              <Bar
                dataKey="income"
                name="Receitas"
                fill="#10B981"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="expense"
                name="Despesas"
                fill="#EF4444"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Spending Donut Chart */}
        <div className="lg:col-span-2 bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-base font-semibold text-white mb-4">
            Top Gastos
          </h3>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry: any, i: number) => (
                      <Cell
                        key={i}
                        fill={entry.color}
                        style={{
                          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))",
                        }}
                      />
                    ))}
                    <Label
                      content={({ viewBox }: any) => {
                        const { cx, cy } = viewBox;
                        return (
                          <g>
                            <text
                              x={cx}
                              y={cy - 6}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#FFFFFF"
                              fontSize={18}
                              fontWeight={700}
                            >
                              {showMoney
                                ? formatCompactCurrency(pieTotal)
                                : "R$ •••••"}
                            </text>
                            <text
                              x={cx}
                              y={cy + 16}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#94A3B8"
                              fontSize={11}
                              fontWeight={500}
                              letterSpacing={1}
                            >
                              TOTAL
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1E2139",
                      border: "1px solid #3B3F5C",
                      borderRadius: 12,
                      padding: "10px 14px",
                    }}
                    itemStyle={{
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                    formatter={(v: number, _name: string, entry: any) => [
                      `${formatCurrency(v, showMoney)} (${entry.payload.percent.toFixed(1)}%)`,
                      entry.payload.name,
                    ]}
                    separator=" "
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-2.5 mt-2">
                {pieData.map((cat: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-muted">{cat.name}</span>
                    </div>
                    <span className="text-white font-semibold">
                      {cat.percent.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted text-sm text-center py-8">
              Nenhum dado de despesa
            </p>
          )}
        </div>
      </div>

      {/* Equity Evolution */}
      <div className="bg-primary-light rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">
            Evolução Patrimonial
          </h3>
          {stats && stats.equityGrowth !== 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-semibold">
              {stats.equityGrowth >= 0 ? "+" : ""}
              {stats.equityGrowth.toFixed(0)}% Crescimento Anual
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={lineData}>
            <defs>
              <linearGradient id="patrimonioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6C63FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#3B3F5C"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "#2A2D4A",
                border: "1px solid #3B3F5C",
                borderRadius: 12,
                color: "#F1F5F9",
              }}
              formatter={(v: number) => formatCurrency(v, showMoney)}
            />
            <Area
              type="monotone"
              dataKey="patrimonio"
              name="Patrimônio"
              stroke="#6C63FF"
              strokeWidth={3}
              fill="url(#patrimonioGrad)"
              dot={{ fill: "#6C63FF", r: 4, strokeWidth: 0 }}
              activeDot={{
                r: 6,
                fill: "#6C63FF",
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Summary Table */}
      <div className="bg-primary-light rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Resumo Mensal</h3>
          <button className="text-accent text-sm font-medium hover:underline cursor-pointer">
            Ver Todos os Meses
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                  Mês
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
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {barData.map((row: any, i: number) => {
                const status =
                  row.saldo > 0
                    ? row.saldo > row.income * 0.3
                      ? "META ATINGIDA"
                      : "NORMAL"
                    : "GASTO EXCESSIVO";
                const statusStyle =
                  status === "META ATINGIDA"
                    ? "bg-success/15 text-success"
                    : status === "NORMAL"
                    ? "bg-muted/15 text-muted"
                    : "bg-danger/15 text-danger";
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
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusStyle}`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
