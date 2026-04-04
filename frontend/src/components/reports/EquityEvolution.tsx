import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../utils/format";

interface EquityEvolutionProps {
  lineData: { name: string; patrimonio: number }[];
  equityGrowth: number | null;
  showMoney: boolean;
}

export default function EquityEvolution({
  lineData,
  equityGrowth,
  showMoney,
}: EquityEvolutionProps) {
  return (
    <div className="bg-primary-light rounded-2xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">
          Evolução Patrimonial
        </h3>
        {equityGrowth !== null && equityGrowth !== 0 && (
          <div className="px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-semibold">
            {equityGrowth >= 0 ? "+" : ""}
            {equityGrowth.toFixed(0)}% Crescimento Anual
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
  );
}
