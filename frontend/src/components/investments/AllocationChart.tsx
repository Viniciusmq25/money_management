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
    <div className="bg-primary-light rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-muted mb-3">Alocação</h3>
      {pieData.length > 0 ? (
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
                label={({ cx, cy, midAngle, outerRadius, payload }) => {
                  if (payload.percent < 5) return null;
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + 16;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="#CBD5E1"
                      fontSize={11}
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
                  <Cell
                    key={i}
                    fill={e.color}
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                    }}
                  />
                ))}
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
                labelStyle={{
                  color: "#94A3B8",
                  fontSize: 12,
                  marginBottom: 4,
                }}
                formatter={(v: number, _name: string, entry: any) => [
                  `${formatCurrency(v, showMoney)} (${entry.payload.percent.toFixed(1)}%)`,
                  entry.payload.name,
                ]}
                separator=" "
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {pieData.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  <span className="text-muted">{e.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted text-xs">
                    {e.percent.toFixed(1)}%
                  </span>
                  <span className="text-white font-medium">
                    {formatCurrency(e.value, showMoney)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted text-sm text-center py-6">
          Nenhum investimento
        </p>
      )}
    </div>
  );
}
