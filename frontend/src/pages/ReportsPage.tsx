import { useEffect, useState } from "react";
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
  LineChart,
  Line,
  Legend,
} from "recharts";
import api from "../api/client";
import { formatCurrency, formatMonth } from "../utils/format";
import { useMoneyVisibility } from "../contexts/MoneyVisibilityContext";
import toast from "react-hot-toast";

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);
  const { showMoney } = useMoneyVisibility();

  useEffect(() => {
    setLoading(true);
    api
      .get("/dashboard/summary", { params: { months } })
      .then((r) => setData(r.data))
      .catch(() => toast.error("Erro ao carregar relatórios"))
      .finally(() => setLoading(false));
  }, [months]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-muted">Erro ao carregar dados.</p>;

  const barData = data.monthly_trend.map((m: any) => ({
    ...m,
    name: formatMonth(m.month),
    saldo: m.income - m.expense,
  }));

  const lineData = data.monthly_trend.map((m: any) => {
    let cumulative = 0;
    for (const item of data.monthly_trend) {
      cumulative += item.income - item.expense;
      if (item.month === m.month) break;
    }
    return {
      name: formatMonth(m.month),
      patrimonio: cumulative + (data.total_invested || 0),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Relatórios</h2>
        <div className="flex gap-2">
          {[3, 6, 12].map((n) => (
            <button
              key={n}
              onClick={() => setMonths(n)}
              className={`px-4 py-2 text-sm rounded-xl font-medium transition cursor-pointer ${
                months === n ? "bg-accent text-white" : "bg-primary-light text-muted border border-border hover:text-white"
              }`}
            >
              {n} meses
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <p className="text-sm text-muted mb-1">Total Receitas (período)</p>
          <p className="text-2xl font-bold text-success">
            {formatCurrency(barData.reduce((s: number, d: any) => s + d.income, 0), showMoney)}
          </p>
        </div>
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <p className="text-sm text-muted mb-1">Total Despesas (período)</p>
          <p className="text-2xl font-bold text-danger">
            {formatCurrency(barData.reduce((s: number, d: any) => s + d.expense, 0), showMoney)}
          </p>
        </div>
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <p className="text-sm text-muted mb-1">Saldo Acumulado</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(barData.reduce((s: number, d: any) => s + d.saldo, 0), showMoney)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart - Income vs Expense */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-muted mb-4">Receitas vs Despesas por Mês</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3B3F5C" />
              <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#2A2D4A", border: "1px solid #3B3F5C", borderRadius: 12, color: "#F1F5F9" }}
                formatter={(v: number) => formatCurrency(v, showMoney)}
              />
              <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 12 }} />
              <Bar dataKey="income" name="Receitas" fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - Category breakdown */}
        <div className="bg-primary-light rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-muted mb-4">Top Categorias de Gasto</h3>
          {data.expense_by_category.length > 0 ? (() => {
            const pieTotal = data.expense_by_category.reduce((acc: number, e: any) => acc + e.value, 0);
            const pieData = data.expense_by_category.map((e: any) => ({
              ...e,
              percent: pieTotal > 0 ? (e.value / pieTotal) * 100 : 0,
            }));
            return (
              <div className="flex flex-col items-center">
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
                      {pieData.map((entry: any, i: number) => (
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
                <div className="w-full space-y-2 mt-3">
                  {pieData.map((cat: any, i: number) => (
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
              </div>
            );
          })() : (
            <p className="text-muted text-sm text-center py-8">Nenhum dado de despesa</p>
          )}
        </div>
      </div>

      {/* Patrimony evolution line chart */}
      <div className="bg-primary-light rounded-2xl p-5 border border-border">
        <h3 className="text-sm font-semibold text-muted mb-4">Evolução Patrimonial</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineData}>
            <defs>
              <linearGradient id="patrimonioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6C63FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3B3F5C" />
            <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} />
            <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#2A2D4A", border: "1px solid #3B3F5C", borderRadius: 12, color: "#F1F5F9" }}
              formatter={(v: number) => formatCurrency(v, showMoney)}
            />
            <Line type="monotone" dataKey="patrimonio" name="Patrimônio" stroke="#6C63FF" strokeWidth={3} dot={{ fill: "#6C63FF", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly summary table */}
      <div className="bg-primary-light rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-muted">Resumo Mensal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase">Mês</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Receitas</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Despesas</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {barData.map((row: any, i: number) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-hover transition">
                  <td className="px-5 py-3 text-sm text-white font-medium">{row.name}</td>
                  <td className="px-5 py-3 text-sm text-success text-right">{formatCurrency(row.income, showMoney)}</td>
                  <td className="px-5 py-3 text-sm text-danger text-right">{formatCurrency(row.expense, showMoney)}</td>
                  <td className={`px-5 py-3 text-sm font-semibold text-right ${row.saldo >= 0 ? "text-success" : "text-danger"}`}>
                    {formatCurrency(row.saldo, showMoney)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
