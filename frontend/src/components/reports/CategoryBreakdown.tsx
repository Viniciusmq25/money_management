import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "../../utils/format";

interface CategoryBreakdownProps {
  activePieData: any[];
  activePieTotal: number;
  selectedPeriodName: string | null;
  selectedPeriod: string | null;
  onClearSelection: () => void;
  showMoney: boolean;
}

export default function CategoryBreakdown({
  activePieData,
  activePieTotal,
  selectedPeriodName,
  selectedPeriod,
  onClearSelection,
  showMoney,
}: CategoryBreakdownProps) {
  return (
    <div className="lg:col-span-2 bg-primary-light rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">
            Distribuição
          </h3>
          {selectedPeriodName && (
            <p className="text-xs text-muted mt-0.5">{selectedPeriodName}</p>
          )}
        </div>
        {selectedPeriod && (
          <button
            onClick={onClearSelection}
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>
      {activePieData.length > 0 ? (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={activePieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {activePieData.map((entry: any, i: number) => (
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
                            ? formatCompactCurrency(activePieTotal)
                            : "R$ •••••"}
                        </text>
                        <text
                          x={cx}
                          y={cy + 16}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#8A93A6"
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
                  background: "#0B0E13",
                  border: "1px solid #1C2330",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 12,
                }}
                itemStyle={{
                  color: "#F5F7FA",
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
            {activePieData.map((cat: any, i: number) => (
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
                  {showMoney ? formatCompactCurrency(cat.value) : "R$ •••••"}
                  <span className="text-muted font-normal ml-1.5">
                    {cat.percent.toFixed(0)}%
                  </span>
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
  );
}
