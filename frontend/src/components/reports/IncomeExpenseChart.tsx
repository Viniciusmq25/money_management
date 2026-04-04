import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "../../utils/format";

interface CategoryEntry {
  name: string;
  color: string;
}

interface CategoryInfo {
  incomeCategories: CategoryEntry[];
  expenseCategories: CategoryEntry[];
}

interface IncomeExpenseChartProps {
  stackedBarData: any[];
  categoryInfo: CategoryInfo;
  selectedPeriod: string | null;
  onBarClick: (data: any) => void;
  onClearSelection: () => void;
  showMoney: boolean;
}

export default function IncomeExpenseChart({
  stackedBarData,
  categoryInfo,
  selectedPeriod,
  onBarClick,
  onClearSelection,
  showMoney,
}: IncomeExpenseChartProps) {
  const renderBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const hoveredMonth = payload[0]?.payload?.month;
    const isSelectedBar = selectedPeriod && hoveredMonth === selectedPeriod;

    if (!isSelectedBar) {
      const income = payload[0]?.payload?.income || 0;
      const expense = payload[0]?.payload?.expense || 0;
      return (
        <div style={{ background: "#2A2D4A", border: "1px solid #3B3F5C", borderRadius: 12, padding: "10px 14px", color: "#F1F5F9" }}>
          <p style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>{label}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 2 }}>
            <span style={{ color: "#10B981", fontSize: 10 }}>●</span>
            <span>Receitas: {formatCurrency(income, showMoney)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ color: "#EF4444", fontSize: 10 }}>●</span>
            <span>Despesas: {formatCurrency(expense, showMoney)}</span>
          </div>
        </div>
      );
    }

    const incomeItems = payload.filter((p: any) => p.dataKey.startsWith("inc_") && p.value > 0);
    const expenseItems = payload.filter((p: any) => p.dataKey.startsWith("exp_") && p.value > 0);

    if (!incomeItems.length && !expenseItems.length) return null;

    return (
      <div style={{ background: "#2A2D4A", border: "1px solid #3B3F5C", borderRadius: 12, padding: "12px 16px", color: "#F1F5F9", maxWidth: 300 }}>
        <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>{label}</p>
        {incomeItems.length > 0 && (
          <div style={{ marginBottom: expenseItems.length ? 8 : 0 }}>
            <p style={{ fontSize: 11, color: "#10B981", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Receitas</p>
            {incomeItems.map((item: any) => (
              <div key={item.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12, marginBottom: 2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: item.fill, fontSize: 10 }}>●</span>
                  {item.dataKey.replace("inc_", "")}
                </span>
                <span style={{ fontWeight: 500 }}>{formatCurrency(item.value, showMoney)}</span>
              </div>
            ))}
          </div>
        )}
        {expenseItems.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Despesas</p>
            {expenseItems.map((item: any) => (
              <div key={item.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12, marginBottom: 2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: item.fill, fontSize: 10 }}>●</span>
                  {item.dataKey.replace("exp_", "")}
                </span>
                <span style={{ fontWeight: 500 }}>{formatCurrency(item.value, showMoney)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
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
          {selectedPeriod && (
            <button
              onClick={onClearSelection}
              className="text-accent hover:underline cursor-pointer ml-1"
            >
              Limpar
            </button>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={stackedBarData}
          barGap={4}
          onClick={onBarClick}
          style={{ cursor: "pointer" }}
        >
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
            content={renderBarTooltip}
            cursor={{ fill: "rgba(107, 99, 255, 0.08)" }}
          />

          {categoryInfo.incomeCategories.map((cat, i) => (
            <Bar
              key={`inc_${cat.name}`}
              dataKey={`inc_${cat.name}`}
              stackId="income"
              maxBarSize={40}
              radius={i === categoryInfo.incomeCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            >
              {stackedBarData.map((entry: any, index: number) => (
                <Cell
                  key={index}
                  fill={entry.month === selectedPeriod ? cat.color : "#10B981"}
                />
              ))}
            </Bar>
          ))}
          {categoryInfo.incomeCategories.length === 0 && (
            <Bar dataKey="income" name="Receitas" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} />
          )}

          {categoryInfo.expenseCategories.map((cat, i) => (
            <Bar
              key={`exp_${cat.name}`}
              dataKey={`exp_${cat.name}`}
              stackId="expense"
              maxBarSize={40}
              radius={i === categoryInfo.expenseCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            >
              {stackedBarData.map((entry: any, index: number) => (
                <Cell
                  key={index}
                  fill={entry.month === selectedPeriod ? cat.color : "#EF4444"}
                />
              ))}
            </Bar>
          ))}
          {categoryInfo.expenseCategories.length === 0 && (
            <Bar dataKey="expense" name="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
