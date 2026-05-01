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

export default function EquityEvolution({ lineData, equityGrowth, showMoney }: EquityEvolutionProps) {
  return (
    <div className="bg-primary-light rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">Evolução Patrimonial</h3>
        {equityGrowth !== null && equityGrowth !== 0 && (
          <div className="px-2 py-1 rounded bg-success/15 text-success text-xs font-semibold font-mono">
            {equityGrowth >= 0 ? "+" : ""}{equityGrowth.toFixed(0)}% a.a.
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={lineData}>
          <defs>
            <linearGradient id="patrimonioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E08A" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#00E08A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1C2330" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: "#0B0E13", border: "1px solid #1C2330", borderRadius: 6, color: "#F5F7FA", fontSize: 12 }}
            formatter={(v: number) => formatCurrency(v, showMoney)}
          />
          <Area
            type="monotone"
            dataKey="patrimonio"
            name="Patrimônio"
            stroke="#00E08A"
            strokeWidth={1.5}
            fill="url(#patrimonioGrad)"
            dot={{ fill: "#00E08A", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#00E08A", stroke: "#07090C", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
