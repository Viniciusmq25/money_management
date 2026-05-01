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
        <div style={{ background: "#0B0E13", border: "1px solid #1C2330", borderRadius: 6, padding: "8px 12px", color: "#F5F7FA", fontSize: 12 }}>
          <p style={{ marginBottom: 4, fontWeight: 600, fontSize: 12 }}>{label}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ color: "#00E08A", fontSize: 10 }}>●</span>
            <span>Receitas: {formatCurrency(income, showMoney)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#FF4D5E", fontSize: 10 }}>●</span>
            <span>Despesas: {formatCurrency(expense, showMoney)}</span>
          </div>
        </div>
      );
    }

    const incomeItems = payload.filter((p: any) => p.dataKey.startsWith("inc_") && p.value > 0);
    const expenseItems = payload.filter((p: any) => p.dataKey.startsWith("exp_") && p.value > 0);

    if (!incomeItems.length && !expenseItems.length) return null;

    return (
      <div style={{ background: "#0B0E13", border: "1px solid #1C2330", borderRadius: 6, padding: "10px 14px", color: "#F5F7FA", maxWidth: 300, fontSize: 12 }}>
        <p style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>{label}</p>
        {incomeItems.length > 0 && (
          <div style={{ marginBottom: expenseItems.length ? 6 : 0 }}>
            <p style={{ fontSize: 10, color: "#00E08A", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Receitas</p>
            {incomeItems.map((item: any) => (
              <div key={item.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11, marginBottom: 2 }}>
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
            <p style={{ fontSize: 10, color: "#FF4D5E", fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Despesas</p>
            {expenseItems.map((item: any) => (
              <div key={item.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11, marginBottom: 2 }}>
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
    <div className="lg:col-span-3 bg-primary-light rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">Receitas vs Despesas</h3>
        <div className="flex items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span>Receitas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-danger" />
            <span>Despesas</span>
          </div>
          {selectedPeriod && (
            <button onClick={onClearSelection} className="text-accent hover:underline cursor-pointer ml-1">
              Limpar
            </button>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={stackedBarData} barGap={4} onClick={onBarClick} style={{ cursor: "pointer" }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1C2330" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={renderBarTooltip} cursor={{ fill: "rgba(0, 224, 138, 0.05)" }} />

          {categoryInfo.incomeCategories.map((cat, i) => (
            <Bar
              key={`inc_${cat.name}`}
              dataKey={`inc_${cat.name}`}
              stackId="income"
              maxBarSize={40}
              radius={i === categoryInfo.incomeCategories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            >
              {stackedBarData.map((entry: any, index: number) => (
                <Cell key={index} fill={entry.month === selectedPeriod ? cat.color : "#00E08A"} />
              ))}
            </Bar>
          ))}
          {categoryInfo.incomeCategories.length === 0 && (
            <Bar dataKey="income" name="Receitas" fill="#00E08A" radius={[3, 3, 0, 0]} maxBarSize={40} />
          )}

          {categoryInfo.expenseCategories.map((cat, i) => (
            <Bar
              key={`exp_${cat.name}`}
              dataKey={`exp_${cat.name}`}
              stackId="expense"
              maxBarSize={40}
              radius={i === categoryInfo.expenseCategories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            >
              {stackedBarData.map((entry: any, index: number) => (
                <Cell key={index} fill={entry.month === selectedPeriod ? cat.color : "#FF4D5E"} />
              ))}
            </Bar>
          ))}
          {categoryInfo.expenseCategories.length === 0 && (
            <Bar dataKey="expense" name="Despesas" fill="#FF4D5E" radius={[3, 3, 0, 0]} maxBarSize={40} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
