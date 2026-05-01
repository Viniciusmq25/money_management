import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "../../utils/format";

interface PieEntry {
  name: string;
  value: number;
  color: string;
  percent: number;
}

interface Props {
  pieData: PieEntry[];
  showMoney: boolean;
}

export default function AllocationChart({ pieData, showMoney }: Props) {
  return (
    <div className="bg-primary-light rounded-lg p-4 border border-border">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Alocação</h3>
      {pieData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
                label={({ cx, cy, midAngle, outerRadius, payload }) => {
                  if (payload.percent < 5) return null;
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + 14;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="#8A93A6"
                      fontSize={10}
                      fontWeight={600}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {`${payload.percent.toFixed(1)}%`}
                    </text>
                  );
                }}
                labelLine={false}
              >
                {pieData.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0B0E13",
                  border: "1px solid #1C2330",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 12,
                }}
                itemStyle={{ color: "#F5F7FA", fontWeight: 500 }}
                labelStyle={{ color: "#8A93A6", marginBottom: 2 }}
                formatter={(v: number, _name: string, entry: any) => [
                  `${formatCurrency(v, showMoney)} (${entry.payload.percent.toFixed(1)}%)`,
                  entry.payload.name,
                ]}
                separator=" "
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                  <span className="text-muted">{e.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted">{e.percent.toFixed(1)}%</span>
                  <span className="text-white font-medium font-mono">{formatCurrency(e.value, showMoney)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted text-sm text-center py-6">Nenhum investimento</p>
      )}
    </div>
  );
}
